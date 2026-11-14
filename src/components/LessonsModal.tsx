import React, { useState } from 'react';
import { WordItem } from '../types';
import {
  BookOpen,
  Search,
  X,
  CheckCircle2,
  Sparkles,
  ChevronLeft,
  RotateCcw,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { normalizeMediaUrl } from '../utils/mediaUrl';

interface LessonsModalProps {
  isOpen: boolean;
  onClose: () => void;
  curriculum: WordItem[];
  selectedItem: WordItem;
  onSelectItem: (item: WordItem, isRetry?: boolean) => void;
  subjectsList: string[];
  selectedSubject: string;
  onSelectSubject: (subject: string) => void;
  scoresMap: Record<string, number>;
  t?: (id: string, fallback?: string) => string;
}

export const LessonsModal: React.FC<LessonsModalProps> = ({
  isOpen,
  onClose,
  curriculum,
  selectedItem,
  onSelectItem,
  subjectsList,
  selectedSubject,
  onSelectSubject,
  scoresMap,
  t,
}) => {
  const tr = (id: string, fallback: string) => (t ? t(id, fallback) : fallback);
  // Categories belonging to the currently selected subject
  const availableCategories = Array.from(
    new Set(
      curriculum
        .filter((item) => !selectedSubject || item.lessonSubject === selectedSubject)
        .map((item) => item.category)
        .filter(Boolean)
    )
  );

  const [activeCategory, setActiveCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState<boolean>(false);

  if (!isOpen) return null;

  const getItemScore = (item: WordItem): number | undefined => {
    const cleanWord = item.word.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '').trim();
    return scoresMap[item.id] ?? scoresMap[item.word] ?? scoresMap[cleanWord];
  };

  const currentCategory =
    activeCategory && availableCategories.includes(activeCategory)
      ? activeCategory
      : availableCategories[0] || '';

  const baseItems = curriculum.filter((item) => {
    const matchesSubject = !selectedSubject || item.lessonSubject === selectedSubject;
    const matchesCat = !currentCategory || item.category === currentCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      item.word.includes(searchQuery) ||
      (item.plainWord && item.plainWord.includes(searchQuery)) ||
      (item.meaning && item.meaning.includes(searchQuery));
    return matchesSubject && matchesCat && matchesSearch;
  });

  const filteredItems = showCompleted
    ? baseItems
    : baseItems.filter((item) => getItemScore(item) === undefined);

  const hasHiddenCompleted =
    !showCompleted &&
    baseItems.length > 0 &&
    filteredItems.length === 0 &&
    baseItems.some((item) => getItemScore(item) !== undefined);

  const handlePickItem = (item: WordItem, isRetry = false) => {
    onSelectItem(item, isRetry);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {tr('lessons_modal_title', 'فهرس الدروس والكلمات')}
              </h3>
              <p className="text-xs text-slate-500">
                {tr('lessons_modal_desc', 'اختر الدرس أو الموضوع للتدرب على كلماته ونطقه')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer border border-slate-200"
            title={tr('btn_close', 'إغلاق')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lesson Subject Dropdown & Search */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-white space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              📚 {tr('lessons_subject_label', 'موضوع الدرس:')}
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => {
                onSelectSubject(e.target.value);
                setActiveCategory('');
              }}
              className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 rounded-2xl text-sm font-bold text-slate-800 focus:outline-hidden transition-all"
            >
              {subjectsList.map((subj) => (
                <option key={subj} value={subj}>
                  {subj}
                </option>
              ))}
            </select>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
            {availableCategories.map((cat) => {
              const catItems = curriculum.filter(
                (c) => (!selectedSubject || c.lessonSubject === selectedSubject) && c.category === cat
              );
              const count = showCompleted
                ? catItems.length
                : catItems.filter((c) => getItemScore(c) === undefined).length;
              const isSelected = currentCategory === cat;
              const translatedCat =
                cat === 'الحرف'
                  ? tr('category_letter', 'الحرف')
                  : cat === 'الكلمة'
                  ? tr('category_word', 'الكلمة')
                  : cat === 'الجملة'
                  ? tr('category_sentence', 'الجملة')
                  : cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {translatedCat} ({count})
                </button>
              );
            })}
          </div>

          {/* Search Box + Icon-only Eye Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr('lessons_search_placeholder', 'ابحث عن كلمة أو حرف أو معنى...')}
                className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-indigo-400 transition-all placeholder:text-slate-400"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowCompleted((prev) => !prev)}
              title={
                showCompleted
                  ? tr('lessons_hide_completed_eye', 'إخفاء الدروس التي تم تسجيل إجابتها')
                  : tr('lessons_show_completed_eye', 'إظهار الدروس التي تم تسجيل إجابتها')
              }
              aria-label={
                showCompleted
                  ? tr('lessons_hide_completed_eye', 'إخفاء الدروس التي تم تسجيل إجابتها')
                  : tr('lessons_show_completed_eye', 'إظهار الدروس التي تم تسجيل إجابتها')
              }
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                showCompleted
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {showCompleted ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Exercises Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2 bg-slate-50/50">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm px-4">
              {hasHiddenCompleted ? (
                <div className="inline-flex flex-col items-center gap-2 max-w-md mx-auto p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-900">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  <p className="text-xs sm:text-sm font-bold leading-relaxed">
                    {tr(
                      'lessons_all_completed_hint',
                      'أتممت جميع دروس هذا القسم! اضغط على أيقونة العين أعلاه لإظهارها أو إعادتها.'
                    )}
                  </p>
                </div>
              ) : (
                <span className="text-slate-400">
                  {tr('lessons_empty_search', 'لا توجد كلمات أو تمارين تطابق البحث في هذا الدرس.')}
                </span>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredItems.map((item) => {
                const isSelected = item.id === selectedItem.id;
                const score = getItemScore(item);
                const isCompleted = score !== undefined;
                const canRetry = item.allowRetry !== false;

                return (
                  <div
                    key={item.id}
                    className={`w-full p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                      isCompleted
                        ? isSelected
                          ? 'bg-emerald-100/80 border-emerald-500 ring-2 ring-emerald-300 shadow-sm'
                          : 'bg-emerald-50/75 hover:bg-emerald-100/60 border-emerald-300 shadow-2xs'
                        : isSelected
                        ? 'bg-indigo-50/90 border-indigo-400 ring-2 ring-indigo-300 shadow-sm'
                        : 'bg-white hover:bg-slate-50 border-slate-200/80 shadow-2xs'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handlePickItem(item, false)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-right cursor-pointer"
                    >
                      {item.imageUrl ? (
                        <img
                          src={normalizeMediaUrl(item.imageUrl)}
                          alt={item.word}
                          className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
                          onError={(e) => {
                            (e.target as any).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                            isCompleted
                              ? 'bg-emerald-200/70 text-emerald-900'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.word.slice(0, 2)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-amiri text-xl font-bold text-slate-900 truncate">
                            {item.word}
                          </span>
                          {item.repeatCount && item.repeatCount > 1 && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 shrink-0">
                              {item.repeatCount}×
                            </span>
                          )}
                        </div>
                        {(() => {
                          const displayMeaning = tr(`lesson_${item.word}_meaning`, item.meaning || '');
                          return (
                            <p className="text-[11px] text-slate-500 truncate">
                              {displayMeaning || item.category}
                            </p>
                          );
                        })()}
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isCompleted ? (
                        <>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              score >= 80
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : score >= 50
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {score}%
                          </span>
                          {canRetry ? (
                            <button
                              type="button"
                              onClick={() => handlePickItem(item, true)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300 text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>{tr('lessons_retry_btn', 'إعادة')}</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold">
                              <Lock className="w-3 h-3" />
                              <span>{tr('lessons_retry_locked', 'مغلق')}</span>
                            </span>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePickItem(item, false)}
                          className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                          aria-label={item.word}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-white flex items-center justify-between text-xs text-slate-500">
          <span>
            {tr('lessons_total_exercises', `إجمالي التدريبات: ${filteredItems.length} كلمة وتمرين`).replace(
              '{count}',
              String(filteredItems.length)
            )}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
          >
            {tr('btn_close', 'إغلاق')}
          </button>
        </div>
      </div>
    </div>
  );
};
