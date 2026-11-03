import React, { useEffect, useRef, useState } from 'react';
import { PronunciationEvaluation, WordItem } from '../types';
import confetti from 'canvas-confetti';
import {
  Award,
  Sparkles,
  Info,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  BookOpen,
  ArrowRight,
  Activity,
  Star,
  Zap,
  CheckCircle2,
  AlertCircle,
  Headphones,
  SlidersHorizontal,
} from 'lucide-react';
import {
  speakArabicBrowser,
  speakArabicGemini,
  playUniversalArabicStream,
  playCustomAudio,
} from '../utils/arabicAudio';

interface EvaluationCardProps {
  evaluation: PronunciationEvaluation;
  targetWordItem: WordItem;
  recordedAudioUrl?: string | null;
  onRetry: () => void;
  onNext: () => void;
  onOpenLessons?: () => void;
  audioEngine: 'browser' | 'gemini';
}

type TabType = 'acoustic' | 'letters' | 'visual';

const TARGET_WAVE_BARS = [
  18, 25, 42, 65, 88, 95, 78, 60, 45, 55, 82, 98, 90, 70, 52, 38,
  28, 45, 72, 85, 92, 80, 64, 48, 35, 50, 68, 75, 55, 38, 22, 15,
];

export const EvaluationCard: React.FC<EvaluationCardProps> = ({
  evaluation,
  targetWordItem,
  recordedAudioUrl,
  onRetry,
  onNext,
  onOpenLessons,
  audioEngine,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('acoustic');
  const [isPlayingTarget, setIsPlayingTarget] = useState(false);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState(false);
  const [selfEvaluation, setSelfEvaluation] = useState<'match' | 'retry' | null>(null);
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
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

  // Handle play recorded audio
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
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (evaluation.score / 100) * circumference;

  const targetRepeat = evaluation.requiredRepetitions || targetWordItem.repeatCount || 1;
  const detectedRepeat = evaluation.repetitionsDetected ?? 0;
  const isRepeatSatisfied = detectedRepeat >= targetRepeat;

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-xl shadow-slate-100 border border-slate-100 transition-all animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* 1. TOP HEADER: Score Ring + Grade + Feedback (Clean, no AI slop badges) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-5 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          {/* Animated SVG Circle */}
          <div className="relative w-22 h-22 sm:w-24 sm:h-24 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-slate-100"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
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
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight font-cairo">
                {evaluation.score}%
              </span>
              <span className="text-[10px] font-bold text-slate-400">الدرجة</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${theme.badge}`}>
                  {evaluation.grade}
                </span>
              </span>

              {/* Difficulty Level Badge */}
              {targetWordItem.difficultyLevel === 'easy' || evaluation.difficultyLevel === 'easy' ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                  سهل 🟢
                </span>
              ) : targetWordItem.difficultyLevel === 'hard' || evaluation.difficultyLevel === 'hard' ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-900 border border-purple-300">
                  متقدم 🔴
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-900 border border-sky-300">
                  متوسط 🟡
                </span>
              )}
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-slate-900">{theme.title}</h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5 leading-relaxed">
              {evaluation.feedback}
            </p>

            {/* Repetition notice if required */}
            {targetRepeat > 1 && (
              <div
                className={`mt-2 px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-xs font-bold ${
                  isRepeatSatisfied
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <RotateCcw className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>
                    التكرار: {detectedRepeat} من أصل {targetRepeat} مرات
                  </span>
                </div>
                <span className="text-[11px] shrink-0 font-extrabold">
                  {isRepeatSatisfied ? '✓ اكتمل' : '⚠ ناقص'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. TARGET WORD + DETECTED SPOKEN TEXT */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-4">
        <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/80 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block mb-1">
              الكلمة المستهدفة:
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-amiri text-slate-800 tracking-wide">
              {targetWordItem.word}
            </div>
          </div>
          {targetWordItem.meaning && (
            <p className="text-xs text-slate-500 mt-1">{targetWordItem.meaning}</p>
          )}
        </div>

        <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/80 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block mb-1">
              ما سُمع من النطق:
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-amiri text-emerald-700 tracking-wide">
              {evaluation.detectedWord || 'صوت مسجل'}
            </div>
          </div>
          <span className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            {evaluation.isMatch ? (
              <span className="text-emerald-700 font-bold">✓ نطق مطابق ومقبول</span>
            ) : (
              <span className="text-amber-700 font-bold">⚠ يحتاج تدقيق في بعض الحروف</span>
            )}
          </span>
        </div>
      </div>

      {/* 3. AUDIO COMPARISON BUTTONS: Teacher Audio & Student Audio */}
      <div className="flex flex-col sm:flex-row items-center gap-2.5 p-2.5 bg-slate-100/70 rounded-2xl border border-slate-200/70 mb-5">
        <button
          onClick={handlePlayTarget}
          disabled={isPlayingTarget}
          className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-emerald-50 text-emerald-800 rounded-xl text-xs sm:text-sm font-bold shadow-xs border border-slate-200 transition-all cursor-pointer"
        >
          <Volume2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{isPlayingTarget ? 'جاري الاستماع للمعلم...' : 'استماع لنطق المعلم'}</span>
        </button>

        <button
          onClick={handlePlayRecorded}
          disabled={!recordedAudioUrl}
          className={`w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs border transition-all cursor-pointer ${
            !recordedAudioUrl
              ? 'bg-slate-200/60 text-slate-400 border-transparent cursor-not-allowed'
              : isPlayingRecorded
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white hover:bg-indigo-50 text-indigo-800 border-slate-200'
          }`}
        >
          {isPlayingRecorded ? (
            <>
              <Pause className="w-4 h-4 shrink-0" />
              <span>إيقاف صوتي</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{recordedAudioUrl ? 'استماع لصوت الطالب المسجل' : 'لم يتوفر تسجيل'}</span>
            </>
          )}
        </button>
      </div>

      {/* 4. THREE CONCISE TABS FOR DETAILS */}
      <div className="mb-5">
        {/* Tab Headers */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80 overflow-x-auto">
          <button
            onClick={() => setActiveTab('acoustic')}
            className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'acoustic'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Headphones className="w-3.5 h-3.5 shrink-0" />
            <span>درجة المقارنة الصوتية</span>
          </button>

          <button
            onClick={() => setActiveTab('letters')}
            className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'letters'
                ? 'bg-white text-emerald-900 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>تحليل الحروف</span>
          </button>

          <button
            onClick={() => setActiveTab('visual')}
            className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'visual'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span>مقارنة البصرية والسمعية</span>
          </button>
        </div>

        {/* Tab Content 1: Acoustic Comparison */}
        {activeTab === 'acoustic' && (
          <div className="mt-3.5 space-y-3 animate-in fade-in duration-200">
            {evaluation.acousticComparison ? (
              <div className="bg-linear-to-br from-indigo-50/70 to-purple-50/50 border border-indigo-200/80 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3 border-b border-indigo-100 pb-2">
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <Headphones className="w-4 h-4 text-indigo-600" />
                    <span>مقارنة البصمة الصوتية مع تسجيل المعلم:</span>
                  </span>
                  <span className="text-[11px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                    بصمة الترددات (MFCC + DTW)
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 mb-3">
                  <div className="bg-white p-2.5 rounded-xl border border-indigo-100 text-center">
                    <span className="text-[10px] text-slate-500 block mb-0.5">تطابق الحروف</span>
                    <span className="text-base font-extrabold text-indigo-600 font-mono">
                      {evaluation.textMatchScore ?? evaluation.score}%
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-indigo-100 text-center">
                    <span className="text-[10px] text-slate-500 block mb-0.5">تطابق البصمة</span>
                    <span className="text-base font-extrabold text-purple-600 font-mono">
                      {evaluation.acousticComparison.similarityScore}%
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-indigo-100 text-center">
                    <span className="text-[10px] text-slate-500 block mb-0.5">زمن النطق</span>
                    <span className="text-base font-extrabold text-emerald-600 font-mono">
                      {evaluation.acousticComparison.studentDuration}ث
                    </span>
                    <span className="text-[9px] text-slate-400 block">
                      (المعلم: {evaluation.acousticComparison.teacherDuration}ث)
                    </span>
                  </div>
                </div>

                <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100 text-xs text-indigo-950 flex items-start gap-2">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>{evaluation.acousticComparison.feedback}</span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-xs text-slate-600">
                <span>
                  لم يُسجل صوت المعلم النموذجي لهذا التمرين بعد. تم التقييم عبر التحليل الفيزيائي المباشر للترددات ومخارج الحروف.
                </span>
              </div>
            )}

            {/* Acoustic Metrics (energy, clarity, speech duration) */}
            {evaluation.acousticMetrics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 block">قوة ونقاء الصوت</span>
                  <span className="text-sm font-extrabold text-emerald-700 font-mono">
                    {evaluation.acousticMetrics.energyLevel}%
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 block">زمن النطق الفعلي</span>
                  <span className="text-sm font-extrabold text-sky-700 font-mono">
                    {evaluation.acousticMetrics.speechDuration}ث
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 block">تطابق المدود</span>
                  <span className="text-sm font-extrabold text-indigo-700 font-mono">
                    {evaluation.acousticMetrics.durationMatchPercent}%
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 block">وضوح المخرج</span>
                  <span className="text-sm font-extrabold text-purple-700 font-mono">
                    {evaluation.acousticMetrics.spectralClarityScore}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content 2: Letter Breakdown */}
        {activeTab === 'letters' && (
          <div className="mt-3.5 space-y-3 animate-in fade-in duration-200">
            {evaluation.letterBreakdown && evaluation.letterBreakdown.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {evaluation.letterBreakdown.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                      item.status === 'صحيح'
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : 'bg-amber-50 text-amber-900 border-amber-200'
                    }`}
                  >
                    <span className="font-amiri text-base font-bold">{item.letter}</span>
                    <span className="text-[11px] opacity-80">
                      {item.status === 'صحيح' ? '✓ سليم' : '⚠ يحتاج ضبط'}
                    </span>
                    {item.comment && (
                      <span className="text-[10px] text-slate-500 hidden sm:inline">
                        ({item.comment})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                جميع مخارج الحروف الأساسية مكتملة ومطابقة.
              </div>
            )}

            {/* Makhraj tip */}
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-3 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-emerald-950 block mb-0.5">
                  إرشاد المخرج الصوتي:
                </span>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  {evaluation.makhrajAdvice || targetWordItem.makhrajTip}
                </p>
                {evaluation.vowelAccuracy && (
                  <p className="text-[11px] text-emerald-800 font-semibold mt-1">
                    دقة الحركات والمدود: {evaluation.vowelAccuracy}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 3: Visual Waveforms & Self Evaluation */}
        {activeTab === 'visual' && (
          <div className="mt-3.5 space-y-3 animate-in fade-in duration-200">
            <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800">
              {/* Upper Waveform: Teacher */}
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="text-xs font-bold text-emerald-300">
                      🔊 نطق المعلم النموذجي
                    </span>
                  </div>
                  <button
                    onClick={handlePlayTarget}
                    disabled={isPlayingTarget}
                    className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-[11px] cursor-pointer"
                  >
                    {isPlayingTarget ? 'جاري الاستماع...' : 'استمع'}
                  </button>
                </div>
                <div className="h-10 flex items-center justify-between gap-1 px-1 bg-slate-900/60 rounded-lg overflow-hidden">
                  {TARGET_WAVE_BARS.map((height, i) => (
                    <div
                      key={i}
                      className={`w-full rounded-full transition-all duration-300 ${
                        isPlayingTarget ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-500/70'
                      }`}
                      style={{
                        height: `${isPlayingTarget ? Math.min(100, height + ((i % 4) * 8)) : height}%`,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Lower Waveform: Student */}
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                    <span className="text-xs font-bold text-indigo-300">
                      🎙️ تسجيل صوتك
                    </span>
                  </div>
                  {recordedAudioUrl && (
                    <button
                      onClick={handlePlayRecorded}
                      className="px-2.5 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[11px] cursor-pointer"
                    >
                      {isPlayingRecorded ? 'إيقاف' : 'استمع'}
                    </button>
                  )}
                </div>
                <div className="h-10 flex items-center justify-between gap-1 px-1 bg-slate-900/60 rounded-lg overflow-hidden">
                  {TARGET_WAVE_BARS.map((val, idx) => {
                    const energyFactor = evaluation.acousticMetrics
                      ? Math.max(0.4, evaluation.acousticMetrics.energyLevel / 100)
                      : evaluation.score >= 80 ? 0.95 : 0.65;
                    const variation = ((idx * 9) % 21) - 10;
                    const barHeight = Math.min(100, Math.max(12, Math.round(val * energyFactor + variation)));
                    return (
                      <div
                        key={idx}
                        className={`w-full rounded-full transition-all duration-300 ${
                          isPlayingRecorded ? 'bg-indigo-400 animate-pulse' : 'bg-indigo-500/70'
                        }`}
                        style={{
                          height: `${isPlayingRecorded ? Math.min(100, barHeight + ((idx % 4) * 7)) : barHeight}%`,
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Self Evaluation */}
              <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-emerald-300">⭐ التقييم الذاتي:</span>
                  <span className="text-[11px] text-slate-400">هل طابق نطقك نطق المعلم؟</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelfEvaluation('match');
                      try {
                        confetti({
                          particleCount: 50,
                          spread: 60,
                          origin: { y: 0.7 },
                        });
                      } catch (e) {}
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      selfEvaluation === 'match'
                        ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-300'
                        : 'bg-emerald-600/70 hover:bg-emerald-600 text-white'
                    }`}
                  >
                    🌟 مطابق ومتقن
                  </button>
                  <button
                    onClick={() => setSelfEvaluation('retry')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      selfEvaluation === 'retry'
                        ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    🔄 أحتاج إعادة
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. BOTTOM ACTIONS: Retry, Open Lessons, Next Exercise */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
        <button
          onClick={onRetry}
          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>إعادة التسجيل</span>
        </button>

        {onOpenLessons && (
          <button
            onClick={onOpenLessons}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 transition-all cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>فتح الدروس 📚</span>
          </button>
        )}

        <button
          onClick={onNext}
          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
        >
          <span>التالي</span>
          <ArrowRight className="w-4 h-4 rotate-180" />
        </button>
      </div>
    </div>
  );
};
