import React, { useState } from 'react';
import { WordItem } from '../types';
import {
  BookOpen,
  Search,
  X,
  CheckCircle2,
  Sparkles,
  ChevronLeft,
  Volume2,
  Gauge,
  RotateCcw,
} from 'lucide-react';
import { normalizeMediaUrl } from '../utils/mediaUrl';

interface LessonsModalProps {
  isOpen: boolean;
  onClose: () => void;
  curriculum: WordItem[];
  selectedItem: WordItem;
  onSelectItem: (item: WordItem) => void;
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

  if (!isOpen) return null;

  const currentCategory =
    activeCategory && availableCategories.includes(activeCategory)
      ? activeCategory
      : availableCategories[0] || '';

  const filteredItems = curriculum.filter((item) => {
    const matchesSubject = !selectedSubject || item.lessonSubject === selectedSubject;
    const matchesCat = !currentCategory || item.category === currentCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      item.word.includes(searchQuery) ||
      (item.plainWord && item.plainWord.includes(searchQuery)) ||
      (item.meaning && item.meaning.includes(searchQuery));
    return matchesSubject && matchesCat && matchesSearch;
  });

  const handlePickItem = (item: WordItem) => {
    onSelectItem(item);
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
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lesson Subject Dropdown & Search */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-white space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              📚 {tr('lessons_modal_desc', 'موضوع الدرس:')}
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
              const count = curriculum.filter(
                (c) => (!selectedSubject || c.lessonSubject === selectedSubject) && c.category === cat
              ).length;
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

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tr('lessons_search_placeholder', 'ابحث عن كلمة أو حرف أو معنى...')}
              className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-indigo-400 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Exercises Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2 bg-slate-50/50">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              لا توجد كلمات أو تمارين تطابق البحث في هذا الدرس.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredItems.map((item) => {
                const isSelected = item.id === selectedItem.id;
                const score = scoresMap[item.id];
                return (
                  <button
                    key={item.id}
                    onClick={() => handlePickItem(item)}
                    className={`w-full text-right p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-indigo-50/90 border-indigo-400 ring-2 ring-indigo-300 shadow-sm'
                        : 'bg-white hover:bg-slate-50 border-slate-200/80 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
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
                        <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
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
                        <p className="text-[11px] text-slate-500 truncate">
                          {item.meaning || item.category}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {score !== undefined ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            score >= 80
                              ? 'bg-emerald-100 text-emerald-800'
                              : score >= 50
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {score}%
                        </span>
                      ) : (
                        <ChevronLeft className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-white flex items-center justify-between text-xs text-slate-500">
          <span>إجمالي التدريبات: {filteredItems.length} كلمة وتمرين</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
