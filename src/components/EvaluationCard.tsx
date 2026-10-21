import React, { useEffect, useRef, useState } from 'react';
import { PronunciationEvaluation, WordItem } from '../types';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ArrowRight,
  Play,
  Pause,
  Award,
  Sparkles,
  Info,
  Volume2,
} from 'lucide-react';
import { speakArabicBrowser, speakArabicGemini, playUniversalArabicStream, playCustomAudio } from '../utils/arabicAudio';

interface EvaluationCardProps {
  evaluation: PronunciationEvaluation;
  targetWordItem: WordItem;
  recordedAudioUrl?: string | null;
  onRetry: () => void;
  onNext: () => void;
  audioEngine: 'browser' | 'gemini';
}

export const EvaluationCard: React.FC<EvaluationCardProps> = ({
  evaluation,
  targetWordItem,
  recordedAudioUrl,
  onRetry,
  onNext,
  audioEngine,
}) => {
  const [isPlayingTarget, setIsPlayingTarget] = useState(false);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState(false);
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Trigger confetti if high score
    if (evaluation.score >= 85) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'],
        });
      } catch (e) {
        console.warn('Confetti error:', e);
      }
    }
  }, [evaluation.score]);

  // Handle play target audio
  const handlePlayTarget = () => {
    if (isPlayingTarget) return;
    setIsPlayingTarget(true);

    const speechTargetText =
      (targetWordItem.autoReadText && targetWordItem.autoReadText.trim()) || targetWordItem.word;

    if (targetWordItem.audioUrl) {
      playCustomAudio(
        targetWordItem.audioUrl,
        speechTargetText,
        0.85,
        () => setIsPlayingTarget(true),
        () => setIsPlayingTarget(false)
      );
    } else if (audioEngine === 'gemini') {
      speakArabicGemini(
        speechTargetText,
        false,
        () => setIsPlayingTarget(true),
        () => setIsPlayingTarget(false)
      );
    } else {
      playUniversalArabicStream(
        speechTargetText,
        0.85,
        () => setIsPlayingTarget(true),
        () => setIsPlayingTarget(false),
        () => {
          speakArabicBrowser(
            speechTargetText,
            0.85,
            () => setIsPlayingTarget(true),
            () => setIsPlayingTarget(false)
          );
        }
      );
    }
  };

  // Handle play student recorded audio
  const handlePlayRecorded = () => {
    if (!recordedAudioUrl) return;

    if (isPlayingRecorded && recordedAudioRef.current) {
      recordedAudioRef.current.pause();
      setIsPlayingRecorded(false);
      return;
    }

    if (!recordedAudioRef.current) {
      recordedAudioRef.current = new Audio(recordedAudioUrl);
      recordedAudioRef.current.onended = () => setIsPlayingRecorded(false);
      recordedAudioRef.current.onerror = () => setIsPlayingRecorded(false);
    }

    recordedAudioRef.current.play();
    setIsPlayingRecorded(true);
  };

  const getScoreTheme = (score: number) => {
    if (score >= 85) {
      return {
        stroke: '#10B981',
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        title: 'نطق ممتاز ومتقن!',
      };
    }
    if (score >= 70) {
      return {
        stroke: '#0ea5e9',
        bg: 'bg-sky-50 text-sky-800 border-sky-200',
        badge: 'bg-sky-100 text-sky-800 border-sky-300',
        title: 'نطق جيد جداً!',
      };
    }
    if (score >= 50) {
      return {
        stroke: '#f59e0b',
        bg: 'bg-amber-50 text-amber-800 border-amber-200',
        badge: 'bg-amber-100 text-amber-800 border-amber-300',
        title: 'نطق مقبول مع ملاحظات',
      };
    }
    return {
      stroke: '#ef4444',
      bg: 'bg-rose-50 text-rose-800 border-rose-200',
      badge: 'bg-rose-100 text-rose-800 border-rose-300',
      title: 'يحتاج إلى مزيد من التمرين',
    };
  };

  const theme = getScoreTheme(evaluation.score);
  const circumference = 2 * Math.PI * 44;
  const strokeDashoffset = circumference - (evaluation.score / 100) * circumference;

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-100 border border-slate-100 transition-all animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Top Banner / Score Ring */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div className="flex items-center gap-5">
          {/* Animated SVG Circle */}
          <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="44"
                className="stroke-slate-100"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke={theme.stroke}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-extrabold text-slate-800 tracking-tight font-cairo">
                {evaluation.score}%
              </span>
              <span className="text-[11px] font-medium text-slate-400">الدرجة</span>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Award className="w-5 h-5 text-emerald-600" />
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${theme.badge}`}>
                  {evaluation.grade}
                </span>
              </span>

              {/* Engine Badge */}
              {evaluation.engineUsed === 'ai' ? (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>تقييم الذكاء الاصطناعي (Gemini AI)</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  <span>التقييم الداخلي المباشر (مطابقة سريعة)</span>
                </span>
              )}
            </div>

            <h3 className="text-xl font-bold text-slate-900">{theme.title}</h3>
            <p className="text-sm text-slate-500 mt-1">{evaluation.feedback}</p>

            {evaluation.engineNotice && (
              <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{evaluation.engineNotice}</span>
              </div>
            )}
          </div>
        </div>

        {/* Audio Comparison Players */}
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200/60 w-full sm:w-auto justify-center">
          {/* Target audio */}
          <button
            onClick={handlePlayTarget}
            disabled={isPlayingTarget}
            className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold shadow-xs border border-slate-200 transition-all hover:border-emerald-300"
            title="استمع للنطق النموذجي"
          >
            <Volume2 className="w-4 h-4 text-emerald-600" />
            <span>نطق المعلم</span>
          </button>

          {/* Recorded audio */}
          {recordedAudioUrl && (
            <button
              onClick={handlePlayRecorded}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold shadow-xs border transition-all ${
                isPlayingRecorded
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white hover:bg-indigo-50 text-indigo-700 border-slate-200 hover:border-indigo-300'
              }`}
              title="استمع لتسجيل صوتك"
            >
              {isPlayingRecorded ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>إيقاف صوتي</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>صوتك المسجل</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Comparison: Target vs Heard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
          <span className="text-xs font-bold text-slate-400 block mb-1">الكلمة المستهدفة:</span>
          <div className="text-2xl font-bold font-amiri text-slate-800 tracking-wide">
            {targetWordItem.word}
          </div>
          {targetWordItem.meaning && (
            <p className="text-xs text-slate-500 mt-1">{targetWordItem.meaning}</p>
          )}
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
          <span className="text-xs font-bold text-slate-400 block mb-1">ما سُمع من نطقك:</span>
          <div className="text-2xl font-bold font-amiri text-emerald-700 tracking-wide">
            {evaluation.detectedWord || 'صوت مسجل'}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            {evaluation.isMatch ? 'نطق مطابق ومقبول' : 'يحتاج دقة أكبر في مخارج بعض الحروف'}
          </span>
        </div>
      </div>

      {/* Letter breakdown pills */}
      {evaluation.letterBreakdown && evaluation.letterBreakdown.length > 0 && (
        <div className="mb-6">
          <h4 className="text-xs font-bold text-slate-600 mb-2.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>تحليل الحروف والمخارج التفصيلي:</span>
          </h4>
          <div className="flex flex-wrap gap-2">
            {evaluation.letterBreakdown.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium ${
                  item.status === 'صحيح'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                <span className="font-amiri text-base font-bold">{item.letter}</span>
                <span className="text-[11px] opacity-75">
                  {item.status === 'صحيح' ? '✓ سليم' : '⚠ يحتاج ضبط'}
                </span>
                {item.comment && (
                  <span className="text-[10px] text-slate-500 hidden sm:inline mr-1">
                    ({item.comment})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Articulation & Makhraj Guidance Card */}
      <div className="bg-linear-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 rounded-2xl p-4 border border-emerald-200/60 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h5 className="text-sm font-bold text-slate-800">
              إرشاد المخرج الصوتي (Makhraj Guide):
            </h5>
            <p className="text-xs text-slate-600 leading-relaxed">
              {evaluation.makhrajAdvice || targetWordItem.makhrajTip}
            </p>
            {evaluation.vowelAccuracy && (
              <div className="text-xs text-emerald-800 font-semibold pt-1">
                دقة الحركات والمدود: {evaluation.vowelAccuracy}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all shadow-xs cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>إعادة المحاولة والتسجيل</span>
        </button>

        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
        >
          <span>التدريب التالي</span>
          <ArrowRight className="w-4 h-4 rotate-180" />
        </button>
      </div>
    </div>
  );
};
