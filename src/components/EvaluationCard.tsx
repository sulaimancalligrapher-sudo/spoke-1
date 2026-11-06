import React, { useEffect, useRef, useState } from 'react';
import { PronunciationEvaluation, WordItem, StudentRegistrant } from '../types';
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
  Send,
  Loader2,
  User,
  ExternalLink,
  Lock,
} from 'lucide-react';
import {
  speakArabicBrowser,
  speakArabicGemini,
  playUniversalArabicStream,
  playCustomAudio,
} from '../utils/arabicAudio';
import { submitStudentAnswerToSheet, STUDENT_AUDIO_DRIVE_FOLDER_ID } from '../utils/googleSheets';
import { FrequencySpectrumComparison } from './FrequencySpectrumComparison';

interface EvaluationCardProps {
  evaluation: PronunciationEvaluation;
  targetWordItem: WordItem;
  recordedAudioUrl?: string | null;
  onRetry: () => void;
  onNext: () => void;
  onOpenLessons?: () => void;
  audioEngine: 'browser' | 'gemini';
  currentStudent?: StudentRegistrant | null;
  webhookUrl?: string;
  driveFolderId?: string;
  studentDriveFolderId?: string;
  lessonSubject?: string;
  wordIndex?: number;
  onRequestLogin?: () => void;
  onSubmissionSuccess?: () => void;
  t?: (id: string, fallback?: string) => string;
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
  currentStudent,
  webhookUrl,
  driveFolderId,
  studentDriveFolderId,
  lessonSubject,
  wordIndex = 0,
  onRequestLogin,
  onSubmissionSuccess,
  t,
}) => {
  const tr = (id: string, fallback: string) => (t ? t(id, fallback) : fallback);
  const [activeTab, setActiveTab] = useState<TabType>('acoustic');
  const [isPlayingTarget, setIsPlayingTarget] = useState(false);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState(false);
  const [selfEvaluation, setSelfEvaluation] = useState<'match' | 'retry' | null>(null);
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null);

  // Answer Submission State (answers 1 sheet + Google Drive audio)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submittedAudioDriveUrl, setSubmittedAudioDriveUrl] = useState<string | null>(null);

  // Reset submission state on new evaluation / word
  useEffect(() => {
    setIsSubmitting(false);
    setSubmissionSuccess(false);
    setSubmissionError(null);
    setSubmittedAudioDriveUrl(null);
  }, [evaluation, targetWordItem.id]);

  const handleSubmitAnswer = async () => {
    if (!currentStudent) {
      if (onRequestLogin) {
        onRequestLogin();
      } else {
        setSubmissionError('يرجى تسجيل دخول المشترك أولاً برقم ID والاسم لتوثيق إجابتك.');
      }
      return;
    }

    if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
      setSubmissionError('رابط Google Sheets Webhook غير محدد في النظام.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const res = await submitStudentAnswerToSheet(webhookUrl, {
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        lessonSubject: lessonSubject || targetWordItem.lessonSubject || 'الدرس الأول',
        targetWord: targetWordItem.word,
        detectedWord: evaluation.detectedWord || '',
        score: evaluation.score,
        grade: evaluation.grade,
        audioBlobUrl: recordedAudioUrl,
        driveFolderId: studentDriveFolderId || driveFolderId || STUDENT_AUDIO_DRIVE_FOLDER_ID,
        studentDriveFolderId: studentDriveFolderId || STUDENT_AUDIO_DRIVE_FOLDER_ID,
        wordIndex: wordIndex >= 0 ? wordIndex : 0,
      });

      if (res.success) {
        setSubmissionSuccess(true);
        if (onSubmissionSuccess) {
          onSubmissionSuccess();
        }
        if (res.audioUrl) {
          setSubmittedAudioDriveUrl(res.audioUrl);
        }
        // Save record to localStorage so PracticeCard shows previously submitted status
        try {
          const studentId = currentStudent?.id || 'guest';
          const subject = (lessonSubject || targetWordItem.lessonSubject || '').trim();
          const word = targetWordItem.word.trim();
          const subKey = `faseeh_sub_${studentId}_${subject}_${word}`;
          const subData = {
            score: evaluation.score,
            grade: evaluation.grade,
            detectedWord: evaluation.detectedWord || '',
            targetWord: targetWordItem.word,
            audioUrl: res.audioUrl || recordedAudioUrl || '',
            date: new Date().toLocaleDateString('ar-SA'),
            time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now(),
          };
          localStorage.setItem(subKey, JSON.stringify(subData));
          localStorage.setItem(`faseeh_sub_any_${subject}_${word}`, JSON.stringify(subData));
        } catch (storageErr) {
          console.warn('LocalStorage save failed:', storageErr);
        }
      } else {
        setSubmissionError(res.message || 'تعذر إرسال الإجابة إلى ورقة answers 1.');
      }
    } catch (err: any) {
      setSubmissionError('حدث خطأ أثناء الإرسال: ' + (err?.message || String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

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
        stroke: '#10b981',
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        title: tr('eval_theme_excellent', 'ممتاز جداً! نطق فصيح ومتقن'),
      };
    }
    if (score >= 75) {
      return {
        stroke: '#0ea5e9',
        bg: 'bg-sky-50 text-sky-800 border-sky-200',
        badge: 'bg-sky-100 text-sky-800 border-sky-300',
        title: tr('eval_theme_very_good', 'نطق جيد جداً!'),
      };
    }
    if (score >= 50) {
      return {
        stroke: '#f59e0b',
        bg: 'bg-amber-50 text-amber-800 border-amber-200',
        badge: 'bg-amber-100 text-amber-800 border-amber-300',
        title: tr('eval_theme_acceptable', 'نطق مقبول مع ملاحظات'),
      };
    }
    return {
      stroke: '#ef4444',
      bg: 'bg-rose-50 text-rose-800 border-rose-200',
      badge: 'bg-rose-100 text-rose-800 border-rose-300',
      title: tr('eval_theme_needs_practice', 'يحتاج إلى مزيد من التمرين'),
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
              <span className="text-[10px] font-bold text-slate-400">
                {tr('eval_score_badge', 'الدرجة')}
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${theme.badge}`}>
                  {evaluation.grade === 'ممتاز'
                    ? tr('grade_excellent', 'ممتاز')
                    : evaluation.grade === 'جيد جداً'
                    ? tr('grade_very_good', 'جيد جداً')
                    : evaluation.grade === 'جيد'
                    ? tr('grade_good', 'جيد')
                    : tr('grade_needs_practice', 'يحتاج تدريب')}
                </span>
              </span>

              {/* Difficulty Level Badge */}
              {targetWordItem.difficultyLevel === 'easy' || evaluation.difficultyLevel === 'easy' ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                  {tr('eval_difficulty_easy', 'سهل 🟢')}
                </span>
              ) : targetWordItem.difficultyLevel === 'hard' || evaluation.difficultyLevel === 'hard' ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-900 border border-purple-300">
                  {tr('eval_difficulty_hard', 'متقدم 🔴')}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-900 border border-sky-300">
                  {tr('eval_difficulty_medium', 'متوسط 🟡')}
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
                    {tr('eval_repetitions_label', 'التكرار:')} {detectedRepeat} / {targetRepeat}
                  </span>
                </div>
                <span className="text-[11px] shrink-0 font-extrabold">
                  {isRepeatSatisfied ? '✓' : '⚠'}
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
              {tr('eval_target_word_label', 'الكلمة المستهدفة:')}
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
              {tr('eval_detected_speech_label', 'ما سُمع من النطق:')}
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-amiri text-emerald-700 tracking-wide">
              {evaluation.detectedWord || targetWordItem.word}
            </div>
          </div>
          <span className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            {evaluation.isMatch ? (
              <span className="text-emerald-700 font-bold">{tr('eval_match_success', '✓ نطق مطابق ومقبول')}</span>
            ) : (
              <span className="text-amber-700 font-bold">{tr('eval_match_warning', '⚠ يحتاج تدقيق في بعض الحروف')}</span>
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
          <span>{isPlayingTarget ? tr('practice_listen_btn', 'جاري الاستماع...') : tr('eval_listen_teacher', 'استماع لنطق المعلم')}</span>
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
              <span>{tr('eval_stop_audio', 'إيقاف صوتي')}</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{recordedAudioUrl ? tr('eval_listen_student', 'استماع لصوت الطالب المسجل') : tr('eval_listen_student', 'استماع للتسجيل')}</span>
            </>
          )}
        </button>
      </div>

      {/* 4. THREE CONCISE TABS FOR DETAILS */}
      <div className="mb-5">
        {/* Tab Headers - Mobile: Text only; Desktop: Text + Icons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80 overflow-x-auto">
          <button
            onClick={() => setActiveTab('acoustic')}
            className={`flex-1 min-w-[90px] sm:min-w-[100px] flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'acoustic'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Headphones className="w-3.5 h-3.5 shrink-0 hidden sm:inline-block" />
            <span>{tr('eval_tab_acoustic', 'مقارنة صوتية')}</span>
          </button>

          <button
            onClick={() => setActiveTab('letters')}
            className={`flex-1 min-w-[90px] sm:min-w-[100px] flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'letters'
                ? 'bg-white text-emerald-900 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0 hidden sm:inline-block" />
            <span>{tr('eval_tab_letters', 'تحليل الحروف')}</span>
          </button>

          <button
            onClick={() => setActiveTab('visual')}
            className={`flex-1 min-w-[90px] sm:min-w-[100px] flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'visual'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5 shrink-0 hidden sm:inline-block" />
            <span>{tr('eval_tab_visual', 'مقارنة بصرية')}</span>
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
                    <span>{tr('eval_mfcc_comparison', 'مقارنة البصمة الصوتية مع تسجيل المعلم:')}</span>
                  </span>
                  <span className="text-[11px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                    MFCC + DTW
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 mb-3">
                  <div className="bg-white p-2.5 rounded-xl border border-indigo-100 text-center">
                    <span className="text-[10px] text-slate-500 block mb-0.5">{tr('eval_char_match', 'تطابق الحروف')}</span>
                    <span className="text-base font-extrabold text-indigo-600 font-mono">
                      {evaluation.textMatchScore ?? evaluation.score}%
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-indigo-100 text-center">
                    <span className="text-[10px] text-slate-500 block mb-0.5">{tr('eval_fingerprint_match', 'تطابق البصمة')}</span>
                    <span className="text-base font-extrabold text-purple-600 font-mono">
                      {evaluation.acousticComparison.similarityScore}%
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-indigo-100 text-center">
                    <span className="text-[10px] text-slate-500 block mb-0.5">{tr('eval_pronunciation_duration', 'زمن النطق')}</span>
                    <span className="text-base font-extrabold text-emerald-600 font-mono">
                      {evaluation.acousticComparison.studentDuration}s
                    </span>
                    <span className="text-[9px] text-slate-400 block font-mono">
                      ({evaluation.acousticComparison.teacherDuration}s)
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
                  {tr('eval_no_teacher_audio_note', 'لم يُسجل صوت المعلم النموذجي لهذا التمرين بعد. تم التقييم عبر التحليل الفيزيائي المباشر للترددات ومخارج الحروف.')}
                </span>
              </div>
            )}

            {/* Acoustic Metrics (energy, clarity, speech duration) */}
            {evaluation.acousticMetrics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 block">{tr('eval_voice_power', 'قوة ونقاء الصوت')}</span>
                  <span className="text-sm font-extrabold text-emerald-700 font-mono">
                    {evaluation.acousticMetrics.energyLevel}%
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 block">{tr('eval_actual_duration', 'زمن النطق الفعلي')}</span>
                  <span className="text-sm font-extrabold text-sky-700 font-mono">
                    {evaluation.acousticMetrics.speechDuration}s
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 block">{tr('eval_elongation_match', 'تطابق المدود')}</span>
                  <span className="text-sm font-extrabold text-indigo-700 font-mono">
                    {evaluation.acousticMetrics.durationMatchPercent}%
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 block">{tr('eval_articulation_clarity', 'وضوح المخرج')}</span>
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
                      {item.status === 'صحيح' ? tr('eval_letter_sound', '✓ سليم') : tr('eval_letter_needs_work', '⚠ يحتاج ضبط')}
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
                {tr('eval_all_letters_sound', 'جميع مخارج الحروف الأساسية مكتملة ومطابقة.')}
              </div>
            )}

            {/* Makhraj tip */}
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-3 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-emerald-950 block mb-0.5">
                  {tr('eval_articulation_guide', 'إرشاد المخرج الصوتي:')}
                </span>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  {evaluation.makhrajAdvice || targetWordItem.makhrajTip}
                </p>
                {evaluation.vowelAccuracy && (
                  <p className="text-[11px] text-emerald-800 font-semibold mt-1">
                    {tr('eval_vowel_accuracy', 'دقة الحركات والمدود:')} {evaluation.vowelAccuracy}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 3: Frequency Spectrum (مقارنة البصرية والسمعية) */}
        {activeTab === 'visual' && (
          <div className="mt-3.5 space-y-3 animate-in fade-in duration-200">
            <FrequencySpectrumComparison
              evaluation={evaluation}
              targetWordItem={targetWordItem}
              recordedAudioUrl={recordedAudioUrl}
            />
          </div>
        )}
      </div>

      {/* 5. APPROVAL & SUBMIT BUTTON (زر توثيق واعتماد الإجابة) */}
      <div className="py-1">
        {submissionError && (
          <div className="mb-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs font-semibold animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{submissionError}</span>
            </div>
            {onRequestLogin && !currentStudent && (
              <button
                onClick={onRequestLogin}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                {tr('nav_student_account', 'دخول المشترك')}
              </button>
            )}
          </div>
        )}

        <button
          onClick={handleSubmitAnswer}
          disabled={isSubmitting || submissionSuccess}
          className={`w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl font-black text-xs sm:text-sm transition-all shadow-md ${
            submissionSuccess
              ? 'bg-emerald-600 text-white shadow-emerald-600/30 cursor-not-allowed opacity-95 ring-2 ring-emerald-300'
              : isSubmitting
              ? 'bg-amber-500 text-white cursor-wait animate-pulse'
              : 'bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-600/25 cursor-pointer active:scale-98'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>{tr('eval_submitting_audio', 'جارٍ رفع الصوت وتوثيق الدرجة... ⏳')}</span>
            </>
          ) : submissionSuccess ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-white" />
              <span>{tr('eval_submit_success', 'تم إرسال إجابتك واعتمادها بنجاح! ✅')}</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>{tr('practice_send_sheets', 'إرسال واعتماد الإجابة 📤')}</span>
            </>
          )}
        </button>
      </div>

      {/* 6. BOTTOM ACTIONS: 3 DISTINCTLY COLORED BUTTONS */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-4 border-t border-slate-100">
        {/* Button 1: إعادة التسجيل (Amber / Gold) */}
        <button
          onClick={onRetry}
          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20 transition-all cursor-pointer active:scale-98"
        >
          <RotateCcw className="w-4 h-4" />
          <span>{tr('practice_re_record_btn', 'إعادة التسجيل')}</span>
        </button>

        {/* Button 2: فتح الدروس (Indigo / Royal Blue) */}
        {onOpenLessons && (
          <button
            onClick={onOpenLessons}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20 transition-all cursor-pointer active:scale-98"
          >
            <BookOpen className="w-4 h-4 text-indigo-100" />
            <span>({tr('nav_open_lessons', 'فتح الدروس')})</span>
          </button>
        )}

        {/* Button 3: التالي (Emerald / Green) */}
        <button
          onClick={onNext}
          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 transition-all cursor-pointer active:scale-98"
        >
          <span>{tr('lessons_next_btn', 'التالي')}</span>
          <ArrowRight className="w-4 h-4 rotate-180" />
        </button>
      </div>
    </div>
  );
};
