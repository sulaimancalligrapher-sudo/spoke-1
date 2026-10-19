import React, { useState } from 'react';
import { WordItem } from '../types';
import {
  BookOpen,
  Search,
  CheckCircle2,
  ChevronLeft,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { normalizeMediaUrl } from '../utils/mediaUrl';

interface CurriculumDrawerProps {
  items: WordItem[];
  selectedItem: WordItem;
  onSelectItem: (item: WordItem) => void;
  scoresMap: Record<string, number>;
  selectedSubject: string;
  onSelectSubject: (subject: string) => void;
  subjectsList: string[];
}

export const CurriculumDrawer: React.FC<CurriculumDrawerProps> = ({
  items,
  selectedItem,
  onSelectItem,
  scoresMap,
  selectedSubject,
  onSelectSubject,
  subjectsList,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('الكل');
  const [searchQuery, setSearchQuery] = useState('');

  // Categories belonging to the currently selected subject
  const availableCategories = Array.from(
    new Set(
      items
        .filter((item) => !selectedSubject || item.lessonSubject === selectedSubject)
        .map((item) => item.category)
    )
  );

  const filteredItems = items.filter((item) => {
    const matchesSubject = !selectedSubject || item.lessonSubject === selectedSubject;
    const matchesCat = activeCategory === 'الكل' || item.category === activeCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      item.word.includes(searchQuery) ||
      item.plainWord.includes(searchQuery) ||
      item.meaning.includes(searchQuery);
    return matchesSubject && matchesCat && matchesSearch;
  });

  return (
    <div className="bg-white rounded-3xl p-5 shadow-lg shadow-slate-100 border border-slate-100 flex flex-col h-full">
      {/* Header */}
      <div className="pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">قائمة الدروس والكلمات</h3>
            <span className="text-[11px] text-slate-400">
              اختر الدرس ثم الفئة للبدء في التدريب
            </span>
          </div>
        </div>

        {/* 1. قائمة منسدلة لاختيار موضوع الدرس */}
        <div className="mt-2">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            موضوع الدرس:
          </label>
          <select
            value={selectedSubject}
            onChange={(e) => {
              onSelectSubject(e.target.value);
              setActiveCategory('الكل');
            }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-emerald-500"
          >
            {subjectsList.map((subj) => (
              <option key={subj} value={subj}>
                {subj}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. تبويبات الفئات التابعة للدرس المختار */}
      <div className="flex gap-1.5 overflow-x-auto py-2.5 no-scrollbar border-b border-slate-100">
        <button
          onClick={() => setActiveCategory('الكل')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeCategory === 'الكل'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          الكل
        </button>

        {availableCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeCategory === cat
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative my-2.5">
        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث عن كلمة أو معنى في هذا الدرس..."
          className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500 focus:bg-white transition-all"
        />
      </div>

      {/* List of words */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 max-h-[460px]">
        {filteredItems.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400">
            لا توجد كلمات تحت هذا التصنيف في هذا الدرس
          </div>
        ) : (
          filteredItems.map((item) => {
            const isSelected = selectedItem.id === item.id;
            const pastScore = scoresMap[item.id];

            return (
              <button
                key={item.id}
                onClick={() => onSelectItem(item)}
                className={`w-full text-right p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-50/80 border-emerald-400/80 shadow-xs'
                    : 'bg-slate-50/60 hover:bg-slate-50 border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Thumbnail Image if present */}
                  {item.imageUrl ? (
                    <img
                      src={normalizeMediaUrl(item.imageUrl)}
                      alt={item.word}
                      className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                      onError={(e) => {
                        (e.target as any).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-amiri text-lg font-bold shrink-0 ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-slate-800 border border-slate-200'
                      }`}
                    >
                      {item.word[0] || 'ك'}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-amiri text-base font-bold text-slate-900 truncate">
                        {item.word}
                      </span>
                      {item.audioUrl && (
                        <span className="text-[10px] text-emerald-600" title="صوت مخصص">
                          🎙️
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
                      {item.meaning}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {pastScore !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        pastScore >= 85
                          ? 'bg-emerald-100 text-emerald-800'
                          : pastScore >= 70
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {pastScore}%
                    </span>
                  )}
                  <ChevronLeft
                    className={`w-4 h-4 transition-transform ${
                      isSelected ? 'text-emerald-700 -translate-x-0.5' : 'text-slate-300'
                    }`}
                  />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
