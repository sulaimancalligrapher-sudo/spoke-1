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
  Zap,
  Activity,
  Star,
  ThumbsUp,
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

const TARGET_WAVE_BARS = [18, 25, 42, 65, 88, 95, 78, 60, 45, 55, 82, 98, 90, 70, 52, 38, 28, 45, 72, 85, 92, 80, 64, 48, 35, 50, 68, 75, 55, 38, 22, 15];

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
  const [selfEvaluation, setSelfEvaluation] = useState<'match' | 'retry' | null>(null);
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
              {evaluation.engineUsed === 'acoustic' ? (
                <span className="flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <Zap className="w-3.5 h-3.5 text-emerald-600" />
                  <span>التحليل الصوتي الفيزيائي المباشر (Acoustic Matching) ⚡</span>
                </span>
              ) : evaluation.engineUsed === 'ai' ? (
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

            {/* Repetition Status Badge */}
            {(targetWordItem.repeatCount && targetWordItem.repeatCount > 1 || (evaluation.requiredRepetitions && evaluation.requiredRepetitions > 1)) && (
              <div
                className={`mt-2.5 p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-bold ${
                  (evaluation.repetitionsDetected || 0) >= (evaluation.requiredRepetitions || targetWordItem.repeatCount || 1)
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-amber-700" />
                  <span>
                    تكرار النطق: {evaluation.repetitionsDetected ?? 0} من أصل {evaluation.requiredRepetitions || targetWordItem.repeatCount} مرات مطلوبة
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] ${
                    (evaluation.repetitionsDetected || 0) >= (evaluation.requiredRepetitions || targetWordItem.repeatCount || 1)
                      ? 'bg-emerald-200/80 text-emerald-950'
                      : 'bg-amber-200/80 text-amber-950'
                  }`}
                >
                  {(evaluation.repetitionsDetected || 0) >= (evaluation.requiredRepetitions || targetWordItem.repeatCount || 1)
                    ? '✓ اكتمل التكرار'
                    : '⚠ ناقص - تم تعديل الدرجة'}
                </span>
              </div>
            )}

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

      {/* Acoustic Waveform & Voice Metrics (for in-browser physical matching) */}
      {evaluation.acousticMetrics && (
        <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-600" />
              <span>مؤشرات البصمة الصوتية الفيزيائية (Acoustic Metrics):</span>
            </h4>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
              معالجة فورية ومحلية ⚡
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white p-3 rounded-xl border border-emerald-100 text-center shadow-2xs">
              <span className="text-[10px] text-slate-500 block mb-0.5">نقاء وقوة الصوت</span>
              <span className="text-base font-extrabold text-emerald-600 font-mono">
                {evaluation.acousticMetrics.energyLevel}%
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-100 text-center shadow-2xs">
              <span className="text-[10px] text-slate-500 block mb-0.5">زمن النطق المسجل</span>
              <span className="text-base font-extrabold text-sky-600 font-mono">
                {evaluation.acousticMetrics.speechDuration}ث
              </span>
              <span className="text-[9px] text-slate-400 block mt-0.5">
                (المثالي: {evaluation.acousticMetrics.expectedDuration}ث)
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-100 text-center shadow-2xs">
              <span className="text-[10px] text-slate-500 block mb-0.5">تطابق المدود والإيقاع</span>
              <span className="text-base font-extrabold text-indigo-600 font-mono">
                {evaluation.acousticMetrics.durationMatchPercent}%
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-100 text-center shadow-2xs">
              <span className="text-[10px] text-slate-500 block mb-0.5">توازن الترددات</span>
              <span className="text-base font-extrabold text-purple-600 font-mono">
                {evaluation.acousticMetrics.spectralClarityScore}%
              </span>
            </div>
          </div>
        </div>
      )}

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

      {/* Visual & Acoustic Comparison: Stacked Waveforms (موجات الصوت فوق وتحت) + Self-Evaluation */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 mb-6 shadow-xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <h4 className="text-sm sm:text-base font-bold text-white">
                المقارنة البصرية والسمعية للموجات الصوتية (الموجات فوق وتحت)
              </h4>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              موجة نطق المعلم في الأعلى، وموجة تسجيل صوتك في الأسفل لمقارنة النبرة والمدود وطول النفس.
            </p>
          </div>
          <span className="self-start sm:self-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            موجات متراكبة (فوق وتحت) 📊
          </span>
        </div>

        {/* 1. Upper Waveform: Teacher / Target Model Wave */}
        <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800 mb-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span className="text-xs font-bold text-emerald-300">
                🔊 موجة نطق المعلم النموذجي (في الأعلى)
              </span>
            </div>
            <button
              onClick={handlePlayTarget}
              disabled={isPlayingTarget}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{isPlayingTarget ? 'جاري الاستماع...' : 'استمع للنموذج'}</span>
            </button>
          </div>

          {/* Visual Waveform Bars for Teacher */}
          <div className="h-14 flex items-center justify-between gap-1 px-2 bg-slate-900/60 rounded-xl overflow-hidden">
            {TARGET_WAVE_BARS.map((height, i) => (
              <div
                key={i}
                className={`w-full rounded-full transition-all duration-300 ${
                  isPlayingTarget ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-500/70 hover:bg-emerald-400'
                }`}
                style={{
                  height: `${isPlayingTarget ? Math.min(100, height + ((i % 4) * 8)) : height}%`,
                }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
            <span>البداية والمخرج</span>
            <span>المدود والحركات الوسطى</span>
            <span>الوقف والتمام</span>
          </div>
        </div>

        {/* 2. Lower Waveform: Student's Recorded Audio Wave */}
        <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800 mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
              <span className="text-xs font-bold text-indigo-300">
                🎙️ موجة صوتك الذي سجلته (في الأسفل)
              </span>
            </div>
            {recordedAudioUrl ? (
              <button
                onClick={handlePlayRecorded}
                className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm"
              >
                {isPlayingRecorded ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlayingRecorded ? 'إيقاف' : 'استمع لصوتك'}</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-500 font-medium">لم يتوفر تسجيل صوتي</span>
            )}
          </div>

          {/* Visual Waveform Bars for Student */}
          <div className="h-14 flex items-center justify-between gap-1 px-2 bg-slate-900/60 rounded-xl overflow-hidden">
            {TARGET_WAVE_BARS.map((val, idx) => {
              const energyFactor = evaluation.acousticMetrics
                ? Math.max(0.4, evaluation.acousticMetrics.energyLevel / 100)
                : evaluation.score >= 80 ? 0.95 : evaluation.score >= 60 ? 0.75 : 0.55;
              const variation = ((idx * 9) % 23) - 11;
              const barHeight = Math.min(100, Math.max(12, Math.round(val * energyFactor + variation)));
              return (
                <div
                  key={idx}
                  className={`w-full rounded-full transition-all duration-300 ${
                    isPlayingRecorded ? 'bg-indigo-400 animate-pulse' : 'bg-indigo-500/70 hover:bg-indigo-400'
                  }`}
                  style={{
                    height: `${isPlayingRecorded ? Math.min(100, barHeight + ((idx % 5) * 7)) : barHeight}%`,
                  }}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
            <span>تطابق نبرة وقوة الصوت: {evaluation.acousticMetrics?.energyLevel ?? (evaluation.score >= 70 ? 88 : 62)}%</span>
            <span>تطابق المد والزمن: {evaluation.acousticMetrics?.durationMatchPercent ?? (evaluation.score >= 70 ? 91 : 68)}%</span>
          </div>
        </div>

        {/* 3. Student Self-Evaluation Section */}
        <div className="p-4 bg-linear-to-r from-emerald-950/60 via-slate-900 to-indigo-950/60 rounded-2xl border border-emerald-500/30">
          <div className="text-center sm:text-right mb-3">
            <span className="text-xs font-bold text-emerald-400 block mb-0.5">
              ⭐ نظام التقييم الذاتي:
            </span>
            <p className="text-xs sm:text-sm text-slate-200 font-semibold">
              قيّم نفسك: بعد الاستماع والمقارنة البصرية، هل طابق نطقك نطق المعلم؟
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                setSelfEvaluation('match');
                try {
                  confetti({
                    particleCount: 60,
                    spread: 60,
                    origin: { y: 0.7 },
                    colors: ['#10B981', '#34D399', '#FBBF24'],
                  });
                } catch (e) {}
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-md ${
                selfEvaluation === 'match'
                  ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-300 scale-105'
                  : 'bg-emerald-600/80 hover:bg-emerald-600 text-white'
              }`}
            >
              <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
              <span>🌟 ممتاز ومطابق</span>
            </button>

            <button
              onClick={() => {
                setSelfEvaluation('retry');
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-md ${
                selfEvaluation === 'retry'
                  ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 scale-105'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40'
              }`}
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>🔄 أحتاج إعادة تدريب</span>
            </button>
          </div>

          {selfEvaluation === 'match' && (
            <div className="mt-3 p-2.5 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-center text-xs font-bold text-emerald-200 animate-in fade-in duration-300">
              ما شاء الله! ثقة واعية وإتقان فصيح. أحسنت النقد السمعي لمخارج حروفك! 🌟
            </div>
          )}

          {selfEvaluation === 'retry' && (
            <div className="mt-3 p-2.5 bg-amber-500/20 border border-amber-400/40 rounded-xl text-center text-xs font-bold text-amber-200 animate-in fade-in duration-300">
              أحسنت التقييم الذاتي! الاستماع الدقيق والحرص على المقارنة هو جوهر الإتقان. اضغط زر "إعادة المحاولة" وسجّل مجدداً! 💪
            </div>
          )}
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
