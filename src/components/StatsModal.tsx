import React, { useRef, useState } from 'react';
import { PracticeHistoryItem, StudentRegistrant } from '../types';
import { X, Award, Play, Pause, User, Loader2 } from 'lucide-react';
import { SupportedLang, TranslationItem, translateEvaluationFeedback } from '../utils/translations';
import { getAlternativeAudioUrls } from '../utils/mediaUrl';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: PracticeHistoryItem[];
  onClearHistory?: () => void;
  currentStudent?: StudentRegistrant | null;
  isSyncingFromSheets?: boolean;
  currentLang?: SupportedLang;
  translations?: TranslationItem[];
  t?: (id: string, fallback?: string) => string;
}

export const StatsModal: React.FC<StatsModalProps> = ({
  isOpen,
  onClose,
  history,
  onClearHistory,
  currentStudent,
  isSyncingFromSheets = false,
  currentLang = 'ar',
  translations,
  t,
}) => {
  const tr = (id: string, fallback: string) => (t ? t(id, fallback) : fallback);
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!isOpen) return null;

  const totalPractices = history.length;
  const avgScore =
    totalPractices > 0
      ? Math.round(history.reduce((acc, curr) => acc + curr.score, 0) / totalPractices)
      : 0;
  const masteredCount = history.filter((h) => h.score >= 85).length;

  const handlePlayVoice = (url: string) => {
    if (activeAudioUrl === url && isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const candidateUrls = getAlternativeAudioUrls(url);
    if (candidateUrls.length === 0) candidateUrls.push(url);

    setActiveAudioUrl(url);
    setIsPlaying(true);

    let candidateIndex = 0;
    const tryPlayNext = () => {
      if (candidateIndex >= candidateUrls.length) {
        setIsPlaying(false);
        return;
      }
      const targetSrc = candidateUrls[candidateIndex];
      candidateIndex++;
      const audio = new Audio(targetSrc);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        tryPlayNext();
      };
      audio.play().catch(() => {
        tryPlayNext();
      });
    };

    tryPlayNext();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute left-5 top-5 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-xs">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {tr('stats_modal_title', 'سجل التقييمات والإنجاز')}
            </h3>
            {currentStudent ? (
              <div className="flex items-center gap-2 text-xs text-slate-600 font-bold mt-0.5">
                <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  <span>{currentStudent.name}</span>
                </span>
                <span className="text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md text-slate-700 font-mono">
                  ID: {currentStudent.id}
                </span>
                <span className="text-[10px] text-emerald-600 font-normal">
                  {tr('stats_verified_in_sheet', '(موثق في ورقة answers 1)')}
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {tr('nav_platform_subtitle', 'متابعة إتقان مخارج الحروف والكلمات')}
              </p>
            )}
          </div>
        </div>

        {/* Live Sync Banner if syncing answers 1 */}
        {isSyncingFromSheets && (
          <div className="mb-4 py-2 px-3 bg-amber-50/90 border border-amber-200 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-amber-900 animate-pulse">
            <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
            <span>{tr('stats_syncing_answers1', 'جاري مزامنة الإنجازات مباشرة من ورقة answers 1...')}</span>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-center">
            <span className="text-[11px] text-slate-400 font-medium block mb-1">
              {tr('stats_total_practices', 'إجمالي التدريبات')}
            </span>
            <span className="text-2xl font-bold font-cairo text-slate-800">
              {totalPractices}
            </span>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 text-center">
            <span className="text-[11px] text-emerald-700 font-medium block mb-1">
              {tr('stats_accuracy_rate', 'معدل الدقة')}
            </span>
            <span className="text-2xl font-bold font-cairo text-emerald-800">
              {avgScore}%
            </span>
          </div>

          <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-3 text-center">
            <span className="text-[11px] text-indigo-700 font-medium block mb-1">
              {tr('stats_mastered_words', 'كلمات متقنة (ممتاز)')}
            </span>
            <span className="text-2xl font-bold font-cairo text-indigo-800">
              {masteredCount}
            </span>
          </div>
        </div>

        {/* History list */}
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-slate-700">
            {tr('stats_recent_attempts', 'آخر المحاولات الصوتية:')}
          </h4>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
          {history.length === 0 ? (
            isSyncingFromSheets ? (
              <div className="text-center py-12 text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                <span>{tr('stats_syncing_answers1', 'جاري مزامنة الإنجازات مباشرة من ورقة answers 1...')}</span>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs">
                {tr('stats_empty_note', 'لم تقم بأي تسجيل صوتي بعد. ابدأ بنطق الكلمات لترى تقييماتك هنا!')}
              </div>
            )
          ) : (
            history.map((item) => {
              const translatedGrade = translateEvaluationFeedback(item.grade, currentLang, translations);
              return (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        item.score >= 85
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.score >= 70
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.score}%
                    </div>
                    <div className="min-w-0">
                      <div className="font-amiri text-base font-bold text-slate-900 leading-tight">
                        {item.word}
                      </div>
                      {translatedGrade && (
                        <div className="text-[11px] font-semibold text-emerald-700 mt-0.5 leading-snug truncate" title={translatedGrade}>
                          {translatedGrade}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400">
                        {tr('stats_detected_label', 'سُمع:')} {item.spokenText || tr('practice_recording_active', 'تسجيل صوتي')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-400">
                      {new Date(item.timestamp).toLocaleTimeString('ar-SA', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {item.recordedAudioUrl && (
                      <button
                        onClick={() => handlePlayVoice(item.recordedAudioUrl!)}
                        className={`p-1.5 rounded-lg border transition-all ${
                          activeAudioUrl === item.recordedAudioUrl && isPlaying
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white hover:bg-emerald-50 text-emerald-700 border-slate-200'
                        }`}
                        title="استمع لصوتك"
                      >
                        {activeAudioUrl === item.recordedAudioUrl && isPlaying ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
