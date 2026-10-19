import React, { useRef, useState } from 'react';
import { PracticeHistoryItem } from '../types';
import { X, Award, Play, Pause, Trash2, Calendar, Target, CheckCircle2 } from 'lucide-react';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: PracticeHistoryItem[];
  onClearHistory: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({
  isOpen,
  onClose,
  history,
  onClearHistory,
}) => {
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

    const audio = new Audio(url);
    audioRef.current = audio;
    setActiveAudioUrl(url);
    setIsPlaying(true);

    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
    audio.play();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute left-5 top-5 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">سجل الإنجاز والتقدم الصوتي</h3>
            <p className="text-xs text-slate-500">متابعة إتقان مخارج الحروف والكلمات</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-center">
            <span className="text-[11px] text-slate-400 font-medium block mb-1">
              إجمالي التدريبات
            </span>
            <span className="text-2xl font-bold font-cairo text-slate-800">
              {totalPractices}
            </span>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 text-center">
            <span className="text-[11px] text-emerald-700 font-medium block mb-1">
              معدل الدقة
            </span>
            <span className="text-2xl font-bold font-cairo text-emerald-800">
              {avgScore}%
            </span>
          </div>

          <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-3 text-center">
            <span className="text-[11px] text-indigo-700 font-medium block mb-1">
              كلمات متقنة (ممتاز)
            </span>
            <span className="text-2xl font-bold font-cairo text-indigo-800">
              {masteredCount}
            </span>
          </div>
        </div>

        {/* History list */}
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-slate-700">آخر المحاولات الصوتية:</h4>
          {history.length > 0 && (
            <button
              onClick={onClearHistory}
              className="text-[11px] text-rose-500 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>مسح السجل</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              لم تقم بأي تسجيل صوتي بعد. ابدأ بنطق الكلمات لترى تقييماتك هنا!
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                      item.score >= 85
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.score >= 70
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {item.score}%
                  </div>
                  <div>
                    <div className="font-amiri text-base font-bold text-slate-900">
                      {item.word}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      سُمع: {item.spokenText || 'تسجيل صوتي'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
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
            ))
          )}
        </div>
      </div>
    </div>
  );
};
