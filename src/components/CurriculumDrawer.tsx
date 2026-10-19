import React, { useState } from 'react';
import { WordItem, PracticeCategory } from '../types';
import {
  BookOpen,
  Search,
  CheckCircle2,
  ChevronLeft,
  Filter,
  PlusCircle,
  Volume2,
} from 'lucide-react';

interface CurriculumDrawerProps {
  items: WordItem[];
  selectedItem: WordItem;
  onSelectItem: (item: WordItem) => void;
  scoresMap: Record<string, number>;
  onOpenCustomModal: () => void;
}

export const CurriculumDrawer: React.FC<CurriculumDrawerProps> = ({
  items,
  selectedItem,
  onSelectItem,
  scoresMap,
  onOpenCustomModal,
}) => {
  const [activeCategory, setActiveCategory] = useState<PracticeCategory | 'all'>('letters');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = items.filter((item) => {
    const matchesCat = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      item.word.includes(searchQuery) ||
      item.plainWord.includes(searchQuery) ||
      item.meaning.includes(searchQuery);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="bg-white rounded-3xl p-5 shadow-lg shadow-slate-100 border border-slate-100 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">منهج التدريب الصوتي</h3>
            <span className="text-[11px] text-slate-400">
              اختر حرفاً أو كلمة للتدرب عليها
            </span>
          </div>
        </div>

        <button
          onClick={onOpenCustomModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all border border-emerald-200/80 cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>كلمة جديدة</span>
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1.5 overflow-x-auto py-3 no-scrollbar border-b border-slate-100">
        {[
          { id: 'letters', label: 'الحروف والمخارج' },
          { id: 'words', label: 'الكلمات' },
          { id: 'minimal-pairs', label: 'مقارنة الحروف' },
          { id: 'sentences', label: 'الجمل' },
          { id: 'all', label: 'الكل' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeCategory === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative my-3">
        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث عن حرف، كلمة، أو معنى..."
          className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500 focus:bg-white transition-all"
        />
      </div>

      {/* List of items */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 max-h-[460px]">
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            لم يتم العثور على نتائج للبحث
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
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-amiri text-lg font-bold shrink-0 ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-800 border border-slate-200'
                    }`}
                  >
                    {item.letterFocus || item.plainWord[0] || 'أ'}
                  </div>

                  <div className="min-w-0">
                    <div className="font-amiri text-base font-bold text-slate-900 truncate">
                      {item.word}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-[170px]">
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
