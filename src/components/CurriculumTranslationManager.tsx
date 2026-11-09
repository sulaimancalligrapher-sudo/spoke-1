import React, { useState, useMemo } from 'react';
import { WordItem } from '../types';
import { TranslationItem, translateSingleWithAI, translateBatchWithAI } from '../utils/translations';
import {
  BookOpen,
  Sparkles,
  Save,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Check,
  Languages,
  Filter,
  FileSpreadsheet,
} from 'lucide-react';

interface CurriculumTranslationManagerProps {
  curriculum: WordItem[];
  translations: TranslationItem[];
  onSaveTranslations: (updated: TranslationItem[]) => void;
  onUpdateWord?: (word: WordItem) => void;
  geminiApiKey?: string;
  webhookUrl?: string;
  onRefreshFromSheets?: () => Promise<void>;
  embedded?: boolean;
}

export const CurriculumTranslationManager: React.FC<CurriculumTranslationManagerProps> = ({
  curriculum,
  translations,
  onSaveTranslations,
  onUpdateWord,
  geminiApiKey,
  webhookUrl,
  onRefreshFromSheets,
  embedded = false,
}) => {
  // Build a lookup map of existing translations
  const translationsMap = useMemo(() => {
    const map = new Map<string, TranslationItem>();
    translations.forEach((t) => map.set(t.id, t));
    return map;
  }, [translations]);

  // Working state of translations items
  const [items, setItems] = useState<TranslationItem[]>(() => {
    return translations;
  });

  // Keep items in sync with external translations prop
  React.useEffect(() => {
    setItems((prev) => {
      const prevMap = new Map<string, TranslationItem>();
      prev.forEach((p) => prevMap.set(p.id, p));

      // Merge new translations
      translations.forEach((t) => {
        const ex = prevMap.get(t.id);
        if (ex) {
          prevMap.set(t.id, {
            ...ex,
            ar: t.ar !== undefined ? t.ar : ex.ar,
            th: t.th !== undefined ? t.th : ex.th,
            en: t.en !== undefined ? t.en : ex.en,
          });
        } else {
          prevMap.set(t.id, t);
        }
      });
      return Array.from(prevMap.values());
    });
  }, [translations]);

  // Filters
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Status & Loaders
  const [translatingKey, setTranslatingKey] = useState<string | null>(null);
  const [isBatchTranslating, setIsBatchTranslating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Available unique subjects from current curriculum
  const availableSubjects = useMemo(() => {
    return Array.from(new Set(curriculum.map((w) => w.lessonSubject).filter(Boolean)));
  }, [curriculum]);

  // Helper to get or initialize a translation item for an exercise field
  const getItem = (id: string, defaultAr: string, categoryLabel: string, sourceNote: string): TranslationItem => {
    const found = items.find((i) => i.id === id);
    if (found) return found;
    return {
      id,
      category: 'lessons',
      categoryLabel,
      ar: defaultAr || '',
      th: '',
      en: '',
      isSheetLinked: true,
      sheetSourceNote: sourceNote,
    };
  };

  const handleUpdateField = (id: string, updates: Partial<TranslationItem>, defaultAr = '', categoryLabel = '', sourceNote = '') => {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === id);
      if (exists) {
        return prev.map((i) => (i.id === id ? { ...i, ...updates } : i));
      }
      return [
        ...prev,
        {
          id,
          category: 'lessons',
          categoryLabel,
          ar: defaultAr,
          th: '',
          en: '',
          isSheetLinked: true,
          sheetSourceNote: sourceNote,
          ...updates,
        },
      ];
    });
  };

  // Single item AI translation
  const handleTranslateSingleField = async (
    id: string,
    arText: string,
    defaultAr: string,
    categoryLabel: string,
    sourceNote: string
  ) => {
    const textToTranslate = (arText || defaultAr || '').trim();
    if (!textToTranslate) {
      alert('يرجى إدخال النص العربي أولاً ليتمكن الذكاء الاصطناعي من ترجمته.');
      return;
    }

    setTranslatingKey(id);
    setStatusMessage('جاري ترجمة النص بالذكاء الاصطناعي للتايلاندية والإنجليزية...');
    try {
      const res = await translateSingleWithAI(textToTranslate, geminiApiKey);
      handleUpdateField(
        id,
        {
          ar: textToTranslate,
          th: res.th,
          en: res.en,
        },
        defaultAr,
        categoryLabel,
        sourceNote
      );
      setStatusMessage(`✨ تمت ترجمة "${textToTranslate.slice(0, 25)}" بنجاح!`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      alert('تعذر إتمام الترجمة: ' + (err?.message || 'خطأ في الاتصال'));
    } finally {
      setTranslatingKey(null);
    }
  };

  // Batch translate all pending/missing exercises in current filtered view
  const handleBatchTranslatePending = async () => {
    const batchPayload: { id: string; text: string }[] = [];

    filteredWords.forEach((w) => {
      const meaningKey = `lesson_${w.word}_meaning`;
      const makhrajKey = `lesson_${w.word}_makhraj`;

      const mItem = getItem(meaningKey, w.meaning, 'المعنى (عامود 6)', `[${w.lessonSubject}] ${w.word}`);
      const kItem = getItem(makhrajKey, w.makhrajTip || '', 'المخرج (عامود 7)', `[${w.lessonSubject}] ${w.word}`);

      if (mItem.ar && (!mItem.th || !mItem.en)) {
        batchPayload.push({ id: meaningKey, text: mItem.ar });
      }
      if (kItem.ar && (!kItem.th || !kItem.en)) {
        batchPayload.push({ id: makhrajKey, text: kItem.ar });
      }
    });

    if (batchPayload.length === 0) {
      alert('جميع التمارين المعروضة حالياً مكتملة الترجمة بالكامل!');
      return;
    }

    if (!confirm(`سيتم استدعاء الذكاء الاصطناعي لترجمة (${batchPayload.length}) حقلاً غير مكتمل إلى التايلاندية والإنجليزية. هل تريد المتابعة؟`)) {
      return;
    }

    setIsBatchTranslating(true);
    setStatusMessage(`جاري ترجمة ${batchPayload.length} حقلاً بواسطة الذكاء الاصطناعي...`);
    try {
      const results = await translateBatchWithAI(batchPayload, geminiApiKey);

      setItems((prev) => {
        const map = new Map<string, TranslationItem>();
        prev.forEach((p) => map.set(p.id, p));

        Object.entries(results).forEach(([id, trans]) => {
          const ex = map.get(id);
          if (ex) {
            map.set(id, {
              ...ex,
              th: trans.th || ex.th,
              en: trans.en || ex.en,
            });
          }
        });
        return Array.from(map.values());
      });

      setStatusMessage(`🎉 اكتملت ترجمة ${batchPayload.length} حقلاً بنجاح! تذكر الضغط على "حفظ ومزامنة الترجمات" لتثبيتها.`);
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      alert('تعذر إكمال الترجمة الجماعية: ' + (err?.message || 'خطأ في الاتصال'));
    } finally {
      setIsBatchTranslating(false);
    }
  };

  // Pull latest updates from Google Sheets
  const handleRefresh = async () => {
    if (!onRefreshFromSheets) return;
    setIsRefreshing(true);
    setStatusMessage('جاري جلب أحدث تمارين ورقة "الدروس" والنصوص المترجمة من Google Sheets...');
    try {
      await onRefreshFromSheets();
      setStatusMessage('✨ تم تحديث ومزامنة كافة التمارين والنصوص من Google Sheets بنجاح!');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      alert('تعذر التحديث من الشيت: ' + (err?.message || 'خطأ في الاتصال'));
    } finally {
      setIsRefreshing(false);
    }
  };

  // Save all translations and sync Columns 6 & 7 with Sheet "الدروس" and "الترجمة"
  const handleSaveAll = () => {
    onSaveTranslations(items);

    // If teacher updated Arabic text directly here, synchronize it back to the curriculum word
    if (onUpdateWord) {
      curriculum.forEach((w) => {
        const meaningItem = items.find((i) => i.id === `lesson_${w.word}_meaning`);
        const makhrajItem = items.find((i) => i.id === `lesson_${w.word}_makhraj`);
        let hasWordChange = false;
        let newMeaning = w.meaning;
        let newMakhraj = w.makhrajTip;

        if (meaningItem && meaningItem.ar !== undefined && meaningItem.ar !== w.meaning) {
          newMeaning = meaningItem.ar;
          hasWordChange = true;
        }
        if (makhrajItem && makhrajItem.ar !== undefined && makhrajItem.ar !== (w.makhrajTip || '')) {
          newMakhraj = makhrajItem.ar;
          hasWordChange = true;
        }

        if (hasWordChange) {
          onUpdateWord({
            ...w,
            meaning: newMeaning,
            makhrajTip: newMakhraj,
          });
        }
      });
    }

    setSaveSuccess(true);
    setStatusMessage('✅ تم حفظ كافة الترجمات بنجاح ومزامنتها مع ورقة الدروس وواجهة الطلاب!');
    setTimeout(() => {
      setSaveSuccess(false);
      setStatusMessage(null);
    }, 4000);
  };

  // Filter exercises
  const filteredWords = useMemo(() => {
    return curriculum.filter((w) => {
      if (!w.word) return false;
      // Subject filter
      if (selectedSubject !== 'all' && w.lessonSubject !== selectedSubject) {
        return false;
      }
      // Status filter
      const mItem = getItem(`lesson_${w.word}_meaning`, w.meaning, 'المعنى', '');
      const kItem = getItem(`lesson_${w.word}_makhraj`, w.makhrajTip || '', 'المخرج', '');
      const isComplete = Boolean(mItem.th && mItem.en && (!kItem.ar || (kItem.th && kItem.en)));

      if (statusFilter === 'completed' && !isComplete) return false;
      if (statusFilter === 'pending' && isComplete) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesWord = w.word.toLowerCase().includes(q) || (w.plainWord && w.plainWord.toLowerCase().includes(q));
        const matchesMeaning = (w.meaning && w.meaning.toLowerCase().includes(q)) || (mItem.th && mItem.th.toLowerCase().includes(q));
        const matchesSubject = w.lessonSubject && w.lessonSubject.toLowerCase().includes(q);
        return matchesWord || matchesMeaning || matchesSubject;
      }

      return true;
    });
  }, [curriculum, selectedSubject, statusFilter, searchQuery, items]);

  // Overall statistics
  const stats = useMemo(() => {
    let completedCount = 0;
    curriculum.forEach((w) => {
      const mItem = getItem(`lesson_${w.word}_meaning`, w.meaning, 'المعنى', '');
      if (mItem.th && mItem.en) completedCount++;
    });
    return {
      total: curriculum.length,
      completed: completedCount,
      pending: Math.max(0, curriculum.length - completedCount),
    };
  }, [curriculum, items]);

  return (
    <div className={embedded ? "space-y-5" : "bg-white rounded-3xl p-5 sm:p-7 shadow-md border border-slate-100 flex flex-col space-y-6"}>
      {/* 1. Header with Title & Stats - Shown only if not embedded */}
      {!embedded && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-indigo-600 to-indigo-800 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/20">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>ترجمة ورقة الدروس والتمارين</span>
                <span className="text-[11px] font-mono px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-bold border border-indigo-200">
                  العامود 6 (المعنى) | العامود 7 (المخرج)
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                نظام مرن ومتصل مباشرة ببيانات ورقة "الدروس": يقبل أي إضافة أو حذف أو تعديل في الشيت، مع ترجمة فورية بالذكاء الاصطناعي
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {onRefreshFromSheets && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                title="جلب أحدث التعديلات والتمارين من ملف Google Sheets"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
                <span>{isRefreshing ? 'جاري التحديث...' : 'تحديث من الشيت'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleBatchTranslatePending}
              disabled={isBatchTranslating}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="ترجمة التمارين غير المكتملة دفعة واحدة بالذكاء الاصطناعي"
            >
              {isBatchTranslating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري الترجمة...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>ترجمة جماعية AI</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              className={`flex items-center gap-1.5 px-4 py-2 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                saveSuccess ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>تم الحفظ</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>حفظ</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 2. Status Message Alert */}
      {statusMessage && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* 3. Summary Stats & Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Subject Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
              📚 الدرس:
            </span>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="all">كل الدروس ({curriculum.length} تمرين)</option>
              {availableSubjects.map((sub) => {
                const count = curriculum.filter((w) => w.lessonSubject === sub).length;
                return (
                  <option key={sub} value={sub}>
                    {sub} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
              الحالة:
            </span>
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  statusFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل ({curriculum.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  statusFilter === 'pending' ? 'bg-amber-500 text-white' : 'text-amber-700 hover:text-amber-900'
                }`}
              >
                بحاجة لترجمة 🟡 ({stats.pending})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('completed')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  statusFilter === 'completed' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                مكتمل 🟢 ({stats.completed})
              </button>
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن كلمة، معنى، أو درس..."
            className="w-full pr-8 pl-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 placeholder:text-slate-400 shadow-2xs"
          />
        </div>
      </div>

      {/* 4. Exercises List */}
      {filteredWords.length === 0 ? (
        <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
          لا توجد تمارين تطابق التصفية الحالية.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWords.map((wordItem, idx) => {
            const meaningKey = `lesson_${wordItem.word}_meaning`;
            const makhrajKey = `lesson_${wordItem.word}_makhraj`;

            const meaningItem = getItem(
              meaningKey,
              wordItem.meaning || '',
              'المعنى (عامود 6)',
              `[${wordItem.lessonSubject || 'الدرس'}] تمرين: ${wordItem.word}`
            );
            const makhrajItem = getItem(
              makhrajKey,
              wordItem.makhrajTip || '',
              'المخرج (عامود 7)',
              `[${wordItem.lessonSubject || 'الدرس'}] تمرين: ${wordItem.word}`
            );

            const isMeaningTranslated = Boolean(meaningItem.th && meaningItem.en);
            const isMakhrajTranslated = !makhrajItem.ar || Boolean(makhrajItem.th && makhrajItem.en);
            const isWordComplete = isMeaningTranslated && isMakhrajTranslated;

            return (
              <div
                key={wordItem.id || `curriculum-word-${idx}`}
                className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 sm:p-5 transition-all hover:border-slate-300 hover:bg-slate-50 space-y-4"
              >
                {/* Exercise Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/60">
                  <div className="flex items-center gap-3">
                    {/* Quranic Word in large calligraphy */}
                    <div className="px-3.5 py-1.5 bg-white border-2 border-emerald-300 rounded-xl shadow-xs">
                      <span className="font-amiri text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-wide">
                        {wordItem.word}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold">
                        📚 {wordItem.lessonSubject || 'الدرس الأول'}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-slate-200/80 text-slate-700 font-semibold text-[11px]">
                        {wordItem.category || 'الكلمة'}
                      </span>
                    </div>
                  </div>

                  {/* Completion Status Badge */}
                  <div>
                    {isWordComplete ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>مكتمل الترجمة 🟢</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>بحاجة لإكمال الترجمة 🟡</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Sub-Section 1: Column 6 (المعنى / Meaning) */}
                <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-sky-50 text-sky-800 font-bold text-xs border border-sky-200">
                      <span>🏷️ العامود 6 في الشيت: المعنى (Meaning)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleTranslateSingleField(
                          meaningKey,
                          meaningItem.ar,
                          wordItem.meaning || '',
                          'المعنى (عامود 6)',
                          `[${wordItem.lessonSubject}] ${wordItem.word}`
                        )
                      }
                      disabled={translatingKey === meaningKey || isBatchTranslating}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-bold transition-all cursor-pointer border border-sky-200 disabled:opacity-50"
                    >
                      {translatingKey === meaningKey ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                          <span>جاري الترجمة...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                          <span>ترجمة المعنى بالذكاء الاصطناعي ✨</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                    {/* Arabic Meaning */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        النص العربي (العامود 6):
                      </label>
                      <input
                        type="text"
                        value={meaningItem.ar}
                        onChange={(e) =>
                          handleUpdateField(
                            meaningKey,
                            { ar: e.target.value },
                            wordItem.meaning || '',
                            'المعنى (عامود 6)',
                            `[${wordItem.lessonSubject}] ${wordItem.word}`
                          )
                        }
                        placeholder="المعنى بالعربية..."
                        className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-sky-500 rounded-xl text-xs font-bold text-slate-800 transition-colors"
                        dir="rtl"
                      />
                    </div>

                    {/* Thai Meaning */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        الترجمة التايلاندية 🇹🇭 (ภาษาไทย):
                      </label>
                      <input
                        type="text"
                        value={meaningItem.th}
                        onChange={(e) =>
                          handleUpdateField(
                            meaningKey,
                            { th: e.target.value },
                            wordItem.meaning || '',
                            'المعنى (عامود 6)',
                            `[${wordItem.lessonSubject}] ${wordItem.word}`
                          )
                        }
                        placeholder="พิมพ์ความหมายภาษาไทย..."
                        className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-sky-500 rounded-xl text-xs text-slate-800 transition-colors"
                        dir="ltr"
                      />
                    </div>

                    {/* English Meaning */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        الترجمة الإنجليزية 🇬🇧 (English):
                      </label>
                      <input
                        type="text"
                        value={meaningItem.en}
                        onChange={(e) =>
                          handleUpdateField(
                            meaningKey,
                            { en: e.target.value },
                            wordItem.meaning || '',
                            'المعنى (عامود 6)',
                            `[${wordItem.lessonSubject}] ${wordItem.word}`
                          )
                        }
                        placeholder="English meaning..."
                        className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-sky-500 rounded-xl text-xs text-slate-800 transition-colors"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                {/* Sub-Section 2: Column 7 (المخرج الصوتي / Makhraj Tip) */}
                <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-800 font-bold text-xs border border-purple-200">
                      <span>🎙️ العامود 7 في الشيت: إرشاد المخرج الصوتي (Makhraj Tip)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleTranslateSingleField(
                          makhrajKey,
                          makhrajItem.ar,
                          wordItem.makhrajTip || '',
                          'المخرج (عامود 7)',
                          `[${wordItem.lessonSubject}] ${wordItem.word}`
                        )
                      }
                      disabled={translatingKey === makhrajKey || isBatchTranslating}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold transition-all cursor-pointer border border-purple-200 disabled:opacity-50"
                    >
                      {translatingKey === makhrajKey ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                          <span>جاري الترجمة...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          <span>ترجمة المخرج بالذكاء الاصطناعي ✨</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                    {/* Arabic Makhraj */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        النص العربي (العامود 7):
                      </label>
                      <input
                        type="text"
                        value={makhrajItem.ar}
                        onChange={(e) =>
                          handleUpdateField(
                            makhrajKey,
                            { ar: e.target.value },
                            wordItem.makhrajTip || '',
                            'المخرج (عامود 7)',
                            `[${wordItem.lessonSubject}] ${wordItem.word}`
                          )
                        }
                        placeholder="إرشاد المخرج بالعربية..."
                        className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-purple-500 rounded-xl text-xs font-bold text-slate-800 transition-colors"
                        dir="rtl"
                      />
                    </div>

                    {/* Thai Makhraj */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        الترجمة التايلاندية 🇹🇭 (ภาษาไทย):
                      </label>
                      <input
                        type="text"
                        value={makhrajItem.th}
                        onChange={(e) =>
                          handleUpdateField(
                            makhrajKey,
                            { th: e.target.value },
                            wordItem.makhrajTip || '',
                            'المخرج (عامود 7)',
                            `[${wordItem.lessonSubject}] ${wordItem.word}`
                          )
                        }
                        placeholder="คำแนะนำฐานเกิดเสียง..."
                        className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-purple-500 rounded-xl text-xs text-slate-800 transition-colors"
                        dir="ltr"
                      />
                    </div>

                    {/* English Makhraj */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        الترجمة الإنجليزية 🇬🇧 (English):
                      </label>
                      <input
                        type="text"
                        value={makhrajItem.en}
                        onChange={(e) =>
                          handleUpdateField(
                            makhrajKey,
                            { en: e.target.value },
                            wordItem.makhrajTip || '',
                            'المخرج (عامود 7)',
                            `[${wordItem.lessonSubject}] ${wordItem.word}`
                          )
                        }
                        placeholder="Articulation guidance..."
                        className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-purple-500 rounded-xl text-xs text-slate-800 transition-colors"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
