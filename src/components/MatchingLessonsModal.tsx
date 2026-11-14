import React, { useState, useMemo } from 'react';
import { MatchingHistoryItem, MatchingLessonSubject } from '../types';
import {
  X,
  Sparkles,
  BookOpen,
  ChevronLeft,
  Image as ImageIcon,
  Volume2,
  Eye,
  EyeOff,
  RotateCcw,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { getQuestionPlainText, parseQuestionBlocks } from '../utils/matchingMedia';
import {
  SupportedLang,
  TranslationItem,
  getTranslatedMatchingSubject,
  getTranslatedMatchingQuestionText,
} from '../utils/translations';
import { extractPercentageFromMatchingText } from '../utils/googleSheets';

interface MatchingLessonsModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: MatchingLessonSubject[];
  activeSubjectId?: string;
  activeExerciseIndex?: number;
  onSelectSubjectExercise: (subjectId: string, exerciseIndex: number, isRetry?: boolean) => void;
  onOpenAdminMatching?: () => void;
  matchingHistory?: MatchingHistoryItem[];
  currentLang?: SupportedLang;
  translations?: TranslationItem[];
  t?: (id: string, fallback?: string) => string;
}

export const MatchingLessonsModal: React.FC<MatchingLessonsModalProps> = ({
  isOpen,
  onClose,
  subjects,
  activeSubjectId,
  activeExerciseIndex = 0,
  onSelectSubjectExercise,
  onOpenAdminMatching,
  matchingHistory = [],
  currentLang = 'ar',
  translations = [],
  t,
}) => {
  const tr = (id: string, fallback: string) => (t ? t(id, fallback) : fallback);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    activeSubjectId || subjects[0]?.id || ''
  );
  const [showCompleted, setShowCompleted] = useState<boolean>(false);

  // Synchronize selectedSubjectId when activeSubjectId or subjects change
  React.useEffect(() => {
    if (activeSubjectId) {
      setSelectedSubjectId(activeSubjectId);
    } else if (subjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [activeSubjectId, subjects]);

  const currentSubject = useMemo(() => {
    return (
      subjects.find((s) => s.id === selectedSubjectId) ||
      subjects[0] ||
      null
    );
  }, [subjects, selectedSubjectId]);

  // Map exerciseNumber -> recorded score percentage for the selected subject
  const subjectScoresMap = useMemo(() => {
    const map: Record<number, number> = {};
    if (!currentSubject || !matchingHistory.length) return map;
    const cleanSubj = (currentSubject.subjectName || '').trim();
    const record = matchingHistory.find(
      (h) => (h.lessonSubject || '').trim() === cleanSubj
    );
    if (record && Array.isArray(record.exercises)) {
      record.exercises.forEach((ex) => {
        map[ex.exerciseNumber] = extractPercentageFromMatchingText(
          ex.formulaString,
          ex.percentage
        );
      });
    }
    return map;
  }, [currentSubject, matchingHistory]);

  const indexedExercises = useMemo(() => {
    if (!currentSubject) return [];
    return currentSubject.exercises
      .map((ex, exIdx) => ({ ex, exIdx }))
      .filter(({ ex }) => showCompleted || subjectScoresMap[ex.exerciseNumber] === undefined);
  }, [currentSubject, showCompleted, subjectScoresMap]);

  const hasHiddenCompleted =
    !showCompleted &&
    Boolean(currentSubject) &&
    currentSubject!.exercises.length > 0 &&
    indexedExercises.length === 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-slate-100 relative max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute left-5 top-5 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          title={tr('btn_close', 'إغلاق')}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-linear-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-purple-600/20 shrink-0">
            <Sparkles className="w-6 h-6 text-purple-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-amiri tracking-wide">
                {tr('matching_modal_title', 'تمارين وصل 🔗')}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {tr('matching_modal_subtitle', 'اختر موضوع الدرس ثم ابدأ التمرين المطلوب مباشرة')}
            </p>
          </div>
        </div>

        {/* Dropdown Subject Selector + Icon-only Eye Toggle */}
        <div className="my-4 bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200 space-y-2">
          <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-purple-600" />
            <span>{tr('matching_modal_choose_subject', 'اختر موضوع الدرس من القائمة:')}</span>
          </label>
          <div className="flex items-center gap-2">
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="flex-1 min-w-0 px-4 py-2.5 bg-white border border-slate-300 focus:border-purple-600 rounded-xl text-xs sm:text-sm font-bold text-slate-800 cursor-pointer focus:outline-hidden transition-all shadow-2xs"
            >
              {subjects.map((subj) => (
                <option key={subj.id} value={subj.id}>
                  {getTranslatedMatchingSubject(subj.subjectName, currentLang, translations)} ({subj.exercises.length} {tr('matching_modal_exercises_word', 'تمارين')})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowCompleted((prev) => !prev)}
              title={
                showCompleted
                  ? tr('matching_hide_completed_eye', 'إخفاء التمارين التي تم تسجيل إجابتها')
                  : tr('matching_show_completed_eye', 'إظهار التمارين التي تم تسجيل إجابتها')
              }
              aria-label={
                showCompleted
                  ? tr('matching_hide_completed_eye', 'إخفاء التمارين التي تم تسجيل إجابتها')
                  : tr('matching_show_completed_eye', 'إظهار التمارين التي تم تسجيل إجابتها')
              }
              className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-2xs ${
                showCompleted
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300'
              }`}
            >
              {showCompleted ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Exercises List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {currentSubject && indexedExercises.length > 0 ? (
            indexedExercises.map(({ ex, exIdx }) => {
              const isCurrent =
                currentSubject.id === activeSubjectId &&
                exIdx === activeExerciseIndex;

              const translatedQuestion = getTranslatedMatchingQuestionText(
                currentSubject.subjectName,
                ex.exerciseNumber,
                getQuestionPlainText(ex.questionText),
                currentLang,
                translations
              );

              const score = subjectScoresMap[ex.exerciseNumber];
              const isCompleted = score !== undefined;
              const canRetry = ex.allowRetry !== false;

              return (
                <div
                  key={ex.id || exIdx}
                  className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isCompleted
                      ? isCurrent
                        ? 'bg-emerald-100/80 border-emerald-500 ring-2 ring-emerald-300/70 shadow-sm'
                        : 'bg-emerald-50/75 hover:bg-emerald-100/60 border-emerald-300 shadow-2xs'
                      : isCurrent
                      ? 'bg-purple-50/90 border-purple-400 ring-2 ring-purple-300/60 shadow-sm'
                      : 'bg-white hover:bg-slate-50 border-slate-200/90 hover:border-purple-300 shadow-2xs'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSubjectExercise(currentSubject.id, exIdx, false);
                      onClose();
                    }}
                    className="flex items-center gap-3 min-w-0 flex-1 text-right cursor-pointer"
                  >
                    <span
                      className={`w-9 h-9 rounded-xl font-extrabold text-xs flex items-center justify-center shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-200/80 text-emerald-900'
                          : 'bg-purple-100 text-purple-900'
                      }`}
                    >
                      {ex.exerciseNumber}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                        <span
                          className={`text-[10px] font-bold ${
                            isCompleted ? 'text-emerald-800' : 'text-purple-700'
                          }`}
                        >
                          {tr('matching_modal_exercise_word', 'تمرين')} {ex.exerciseNumber}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.2 bg-purple-600 text-white text-[9px] font-bold rounded-md">
                            {tr('matching_modal_current_badge', 'الحالي')}
                          </span>
                        )}
                        {parseQuestionBlocks(ex.questionText).some((b) => b.type === 'image') && (
                          <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 text-[9px] font-bold rounded-md inline-flex items-center gap-0.5">
                            <ImageIcon className="w-2.5 h-2.5" />
                            <span>{currentLang === 'ar' ? 'صورة' : currentLang === 'th' ? 'รูปภาพ' : 'Image'}</span>
                          </span>
                        )}
                        {parseQuestionBlocks(ex.questionText).some((b) => b.type === 'audio') && (
                          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-bold rounded-md inline-flex items-center gap-0.5">
                            <Volume2 className="w-2.5 h-2.5" />
                            <span>{currentLang === 'ar' ? 'صوت' : currentLang === 'th' ? 'เสียง' : 'Audio'}</span>
                          </span>
                        )}
                      </div>
                      <h4 className="text-base sm:text-lg font-bold text-slate-900 font-amiri leading-snug">
                        {translatedQuestion}
                      </h4>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    {isCompleted ? (
                      <>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            score >= 85
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : score >= 70
                              ? 'bg-sky-100 text-sky-800 border border-sky-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {score}%
                        </span>
                        {canRetry ? (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectSubjectExercise(currentSubject.id, exIdx, true);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{tr('matching_retry_short', 'إعادة')}</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold">
                            <Lock className="w-3 h-3" />
                            <span>{tr('lessons_retry_locked', 'مغلق')}</span>
                          </span>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectSubjectExercise(currentSubject.id, exIdx, false);
                          onClose();
                        }}
                        className="p-1 text-slate-400 hover:text-purple-600 cursor-pointer"
                        aria-label={translatedQuestion}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : hasHiddenCompleted ? (
            <div className="text-center py-10 px-4">
              <div className="inline-flex flex-col items-center gap-2 max-w-md mx-auto p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-900">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                <p className="text-xs sm:text-sm font-bold leading-relaxed">
                  {tr(
                    'matching_all_completed_hint',
                    'أتممت جميع تمارين هذا الموضوع! اضغط على أيقونة العين أعلاه لإظهارها أو إعادتها.'
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              {tr('matching_modal_empty', 'لا توجد تمارين مضافة في هذا الموضوع حالياً.')}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 mt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          {onOpenAdminMatching && (
            <button
              onClick={() => {
                onClose();
                onOpenAdminMatching();
              }}
              className="text-xs text-purple-700 hover:text-purple-900 font-bold flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>إدارة وإضافة تمارين وصل في لوحة التحكم</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer mr-auto"
          >
            {tr('btn_close', 'إغلاق')}
          </button>
        </div>
      </div>
    </div>
  );
};
