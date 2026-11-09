import React, { useState } from 'react';
import {
  TranslationItem,
  SupportedLang,
  translateSingleWithAI,
  translateBatchWithAI,
} from '../utils/translations';
import { WordItem } from '../types';
import {
  Languages,
  Sparkles,
  Save,
  Check,
  Search,
  RefreshCw,
  Info,
  ExternalLink,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { ensureTranslationsSheet } from '../utils/googleSheets';
import { CurriculumTranslationManager } from './CurriculumTranslationManager';

interface TranslationManagerProps {
  translations: TranslationItem[];
  onSaveTranslations: (updated: TranslationItem[]) => void;
  onUpdateWord?: (word: WordItem) => void;
  geminiApiKey?: string;
  webhookUrl?: string;
  curriculum?: WordItem[];
  onRefreshFromSheets?: () => Promise<void>;
}

export const TranslationManager: React.FC<TranslationManagerProps> = ({
  translations,
  onSaveTranslations,
  onUpdateWord,
  geminiApiKey,
  webhookUrl,
  curriculum = [],
  onRefreshFromSheets,
}) => {
  // Build initial items merging translations with curriculum exercises (Columns 6 & 7)
  const buildMergedItems = (baseList: TranslationItem[], words: WordItem[]) => {
    const map = new Map<string, TranslationItem>();
    baseList.forEach((item) => map.set(item.id, item));

    // Dynamic items for each word in curriculum (Columns 6 & 7)
    if (words && words.length > 0) {
      words.forEach((w) => {
        if (!w.word) return;
        const meaningKey = `lesson_${w.word}_meaning`;
        const makhrajKey = `lesson_${w.word}_makhraj`;

        // Column 6: المعنى
        const existingMeaning = map.get(meaningKey);
        if (!existingMeaning) {
          map.set(meaningKey, {
            id: meaningKey,
            category: 'lessons',
            categoryLabel: 'تمارين الدروس - المعنى (عامود 6)',
            ar: w.meaning || '',
            th: '',
            en: '',
            isSheetLinked: true,
            sheetSourceNote: `[${w.lessonSubject || 'الدرس'}] تمرين: ${w.word} - المعنى (عامود 6)`,
          });
        } else {
          map.set(meaningKey, {
            ...existingMeaning,
            category: 'lessons',
            categoryLabel: 'تمارين الدروس - المعنى (عامود 6)',
            isSheetLinked: true,
            sheetSourceNote: `[${w.lessonSubject || 'الدرس'}] تمرين: ${w.word} - المعنى (عامود 6)`,
            ar: existingMeaning.ar !== undefined && existingMeaning.ar !== '' ? existingMeaning.ar : (w.meaning || ''),
          });
        }

        // Column 7: المخرج
        const existingMakhraj = map.get(makhrajKey);
        if (!existingMakhraj) {
          map.set(makhrajKey, {
            id: makhrajKey,
            category: 'lessons',
            categoryLabel: 'تمارين الدروس - المخرج (عامود 7)',
            ar: w.makhrajTip || '',
            th: '',
            en: '',
            isSheetLinked: true,
            sheetSourceNote: `[${w.lessonSubject || 'الدرس'}] تمرين: ${w.word} - المخرج (عامود 7)`,
          });
        } else {
          map.set(makhrajKey, {
            ...existingMakhraj,
            category: 'lessons',
            categoryLabel: 'تمارين الدروس - المخرج (عامود 7)',
            isSheetLinked: true,
            sheetSourceNote: `[${w.lessonSubject || 'الدرس'}] تمرين: ${w.word} - المخرج (عامود 7)`,
            ar: existingMakhraj.ar !== undefined && existingMakhraj.ar !== '' ? existingMakhraj.ar : (w.makhrajTip || ''),
          });
        }
      });
    }

    return Array.from(map.values());
  };

  const [items, setItems] = useState<TranslationItem[]>(() =>
    buildMergedItems(translations, curriculum)
  );
  const [activeTab, setActiveTab] = useState<'home' | 'lessons' | 'practice' | 'curriculum_sheet'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');

  const availableSubjects = React.useMemo(() => {
    return Array.from(new Set(curriculum.map((w) => w.lessonSubject).filter(Boolean)));
  }, [curriculum]);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [isBatchTranslating, setIsBatchTranslating] = useState(false);
  const [isRefreshingFromSheets, setIsRefreshingFromSheets] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Sync state if external translations or curriculum changes
  React.useEffect(() => {
    setItems((prev) => {
      const merged = buildMergedItems(translations, curriculum);
      const prevMap = new Map<string, TranslationItem>();
      prev.forEach((p) => prevMap.set(p.id, p));

      return merged.map((m) => {
        const existing = prevMap.get(m.id);
        if (existing) {
          return {
            ...m,
            ar: existing.ar !== undefined ? existing.ar : m.ar,
            th: existing.th !== undefined ? existing.th : m.th,
            en: existing.en !== undefined ? existing.en : m.en,
          };
        }
        return m;
      });
    });
  }, [translations, curriculum]);

  const handleRefreshFromSheets = async () => {
    if (!onRefreshFromSheets) return;
    setIsRefreshingFromSheets(true);
    setStatusMessage('جاري جلب وتحديث كافة البيانات والنصوص والترجمات من ورقة Google Sheets...');
    try {
      await onRefreshFromSheets();
      setStatusMessage('✨ تم تحديث ومزامنة كافة البيانات والترجمات بنجاح من ورقة الشيت!');
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (e: any) {
      alert('تعذر التحديث من الشيت: ' + (e?.message || 'تأكد من الاتصال بالشيت'));
    } finally {
      setIsRefreshingFromSheets(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (item.category !== activeTab) return false;
    if (activeTab === 'lessons' && selectedSubjectFilter !== 'all') {
      if (item.sheetSourceNote && !item.sheetSourceNote.includes(`[${selectedSubjectFilter}]`)) {
        return false;
      }
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      item.id.toLowerCase().includes(q) ||
      item.ar.toLowerCase().includes(q) ||
      item.th.toLowerCase().includes(q) ||
      item.en.toLowerCase().includes(q) ||
      (item.sheetSourceNote && item.sheetSourceNote.toLowerCase().includes(q))
    );
  });

  const handleUpdateItem = (id: string, updates: Partial<TranslationItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleTranslateSingle = async (item: TranslationItem) => {
    if (!item.ar || !item.ar.trim()) {
      alert('يرجى إدخال النص العربي أولاً ليتم ترجمته بالذكاء الاصطناعي.');
      return;
    }
    setTranslatingId(item.id);
    setStatusMessage('جاري استدعاء نموذج الذكاء الاصطناعي للترجمة...');
    try {
      const result = await translateSingleWithAI(item.ar, geminiApiKey);
      handleUpdateItem(item.id, {
        th: result.th !== undefined ? result.th : item.th,
        en: result.en !== undefined ? result.en : item.en,
      });
      setStatusMessage(`✨ تم ترجمة "${item.ar.slice(0, 25)}" بالذكاء الاصطناعي بنجاح`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (e: any) {
      alert('تعذر الترجمة: ' + (e?.message || 'تأكد من الاتصال'));
    } finally {
      setTranslatingId(null);
    }
  };

  const handleTranslateAllInTab = async () => {
    if (activeTab === 'curriculum_sheet') {
      const batchPayload: { id: string; text: string }[] = [];
      curriculum.forEach((w) => {
        if (!w.word) return;
        const meaningKey = `lesson_${w.word}_meaning`;
        const makhrajKey = `lesson_${w.word}_makhraj`;
        const mItem = items.find((i) => i.id === meaningKey);
        const kItem = items.find((i) => i.id === makhrajKey);

        const mAr = (mItem?.ar !== undefined ? mItem.ar : w.meaning) || '';
        const kAr = (kItem?.ar !== undefined ? kItem.ar : w.makhrajTip) || '';

        if (mAr && (!mItem?.th || !mItem?.en)) {
          batchPayload.push({ id: meaningKey, text: mAr });
        }
        if (kAr && (!kItem?.th || !kItem?.en)) {
          batchPayload.push({ id: makhrajKey, text: kAr });
        }
      });

      if (batchPayload.length === 0) {
        alert('جميع معاني ومخارج تمارين الدروس مكتملة الترجمة!');
        return;
      }

      if (!confirm(`سيتم استدعاء الذكاء الاصطناعي لترجمة (${batchPayload.length}) حقلاً غير مكتمل في تمارين الدروس. هل تريد المتابعة؟`)) {
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
        setStatusMessage(`🎉 اكتملت الترجمة الجماعية بنجاح! اضغط "حفظ" لتثبيت التعديلات.`);
        setTimeout(() => setStatusMessage(null), 5000);
      } catch (e: any) {
        alert('تعذر إكمال الترجمة الجماعية: ' + (e?.message || 'خطأ في الاتصال'));
      } finally {
        setIsBatchTranslating(false);
      }
      return;
    }

    const tabItems = items.filter((i) => i.category === activeTab);
    if (tabItems.length === 0) return;

    if (!confirm(`هل تريد ترجمة جميع نصوص هذا القسم (${tabItems.length} نصوص) إلى التايلاندية والإنجليزية بالذكاء الاصطناعي دفعة واحدة؟`)) {
      return;
    }

    setIsBatchTranslating(true);
    setStatusMessage('جاري استدعاء نموذج الذكاء الاصطناعي وترجمة جميع النصوص...');
    try {
      const batchPayload = tabItems.map((i) => ({ id: i.id, text: i.ar }));
      const results = await translateBatchWithAI(batchPayload, geminiApiKey);
      setItems((prev) =>
        prev.map((item) => {
          if (item.category === activeTab && results[item.id]) {
            return {
              ...item,
              th: results[item.id].th !== undefined ? results[item.id].th : item.th,
              en: results[item.id].en !== undefined ? results[item.id].en : item.en,
            };
          }
          return item;
        })
      );
      setStatusMessage(`🎉 تم ترجمة جميع نصوص القسم بالذكاء الاصطناعي بنجاح! لا تنسَ الضغط على "حفظ".`);
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (e: any) {
      alert('تعذر إكمال الترجمة الجماعية: ' + (e?.message || 'خطأ في الاتصال'));
    } finally {
      setIsBatchTranslating(false);
    }
  };

  const handleSaveAll = () => {
    onSaveTranslations(items);

    // If teacher updated Arabic text directly, sync to curriculum
    if (onUpdateWord && curriculum.length > 0) {
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
    setStatusMessage('✅ تم حفظ كافة الترجمات بنجاح وتفعيلها في واجهة الطلاب!');
    setTimeout(() => {
      setSaveSuccess(false);
      setStatusMessage(null);
    }, 3500);
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-md border border-slate-100 flex flex-col space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shadow-xs">
            <Languages className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>إدارة وتخصيص الترجمة متعددة اللغات</span>
              <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 rounded-md text-slate-600 font-bold">
                🇸🇦 العربية | 🇹🇭 ไทย | 🇬🇧 English
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              ترجمة نصوص واجهة الطلاب مع الترجمة الفورية بالذكاء الاصطناعي والحفاظ على النصوص القرآنية الفصيحة
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onRefreshFromSheets && (
            <button
              type="button"
              onClick={handleRefreshFromSheets}
              disabled={isRefreshingFromSheets}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="جلب وتحديث كافة البيانات والنصوص والترجمات من Google Sheets"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isRefreshingFromSheets ? 'animate-spin' : ''}`} />
              <span>{isRefreshingFromSheets ? 'جاري التحديث...' : 'تحديث من الشيت'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleTranslateAllInTab}
            disabled={isBatchTranslating}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="ترجمة جماعية بالذكاء الاصطناعي"
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

      {/* Status Notice */}
      {statusMessage && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Organization Rules Notice */}
      <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200/80 text-xs text-amber-950 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>ملاحظة تنظيمية هامة:</strong> كلمات وحروف وتراكيب المنهج القرآني/العربي تبقى ثابتة بالعربية الفصحى مع التشكيل دائماً لحفظ قدسيتها. النصوص المرتبطة بورقة <strong>"الرئيسية"</strong> (مثل العنوان والوصف) يتم تعديل أصلها العربي من ورقة الرئيسية لمنع التداخل والتكرار، بينما تخصص هذه الشاشة لضبط الترجمتين التايلاندية والإنجليزية.
        </div>
      </div>

      {/* Sub-Tabs: 4 user-specified categories */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'home'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            ١- نافذة التسجيل والصفحة الرئيسية ({items.filter((i) => i.category === 'home').length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('lessons')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'lessons'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            ٢- نصوص صفحة الدروس العامة ({items.filter((i) => i.category === 'lessons').length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('practice')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'practice'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            ٣- صفحة تسجيل الصوت والنتائج ({items.filter((i) => i.category === 'practice').length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('curriculum_sheet')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'curriculum_sheet'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>٤- ترجمة ورقة الدروس (العامود 6 و 7) ({curriculum.length})</span>
          </button>
        </div>

        {/* Subject Filter (shown on lessons tab) + Search */}
        {activeTab !== 'curriculum_sheet' && (
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {activeTab === 'lessons' && availableSubjects.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">
                  📚 تصفية بالدرس:
                </span>
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">كل موضوعات ورقة الدروس ({curriculum.length} تمرين)</option>
                  {availableSubjects.map((sub) => {
                    const count = curriculum.filter((w) => w.lessonSubject === sub).length;
                    return (
                      <option key={sub} value={sub}>
                        {sub} ({count} تمرين)
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Search */}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في نصوص هذا القسم..."
                className="w-full pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tab 4: Curriculum Translation (Columns 6 & 7) */}
      {activeTab === 'curriculum_sheet' ? (
        <CurriculumTranslationManager
          embedded={true}
          curriculum={curriculum}
          translations={items}
          onSaveTranslations={(updated) => {
            setItems(updated);
            onSaveTranslations(updated);
          }}
          onUpdateWord={onUpdateWord}
          geminiApiKey={geminiApiKey}
          webhookUrl={webhookUrl}
          onRefreshFromSheets={onRefreshFromSheets}
        />
      ) : (
        <>
          {/* Translations Table for Tabs 1, 2, 3 */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="p-3 w-1/4">النص العربي الأصلي 🇸🇦</th>
                  <th className="p-3 w-1/3">الترجمة التايلاندية (ภาษาไทย) 🇹🇭</th>
                  <th className="p-3 w-1/3">الترجمة الإنجليزية (English) 🇬🇧</th>
                  <th className="p-3 text-center w-24">الذكاء الاصطناعي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Arabic Column - Editable */}
                    <td className="p-3 align-top">
                      <textarea
                        rows={2}
                        value={item.ar}
                        onChange={(e) => handleUpdateItem(item.id, { ar: e.target.value })}
                        placeholder="اكتب أو عدّل النص العربي..."
                        className="w-full p-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold text-slate-900 transition-colors resize-y leading-relaxed font-cairo"
                        dir="rtl"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-1 mt-1">
                        <span className="text-[10px] text-slate-400 font-mono">ID: {item.id}</span>
                        {item.isSheetLinked && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[9px] font-bold">
                            🔗 {item.sheetSourceNote || 'متصل بالشيت'}
                          </span>
                        )}
                        {item.id.endsWith('_meaning') && (
                          <span className="px-1.5 py-0.5 bg-sky-100 text-sky-800 rounded-md text-[9px] font-bold">
                            🏷️ عامود 6: المعنى
                          </span>
                        )}
                        {item.id.endsWith('_makhraj') && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded-md text-[9px] font-bold">
                            🎙️ عامود 7: المخرج
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Thai Column */}
                    <td className="p-3 align-top">
                      <textarea
                        rows={2}
                        value={item.th}
                        onChange={(e) => handleUpdateItem(item.id, { th: e.target.value })}
                        placeholder="พิมพ์คำแปลภาษาไทย..."
                        className="w-full p-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs text-slate-900 transition-colors resize-y leading-relaxed font-sans"
                        dir="ltr"
                      />
                    </td>

                    {/* English Column */}
                    <td className="p-3 align-top">
                      <textarea
                        rows={2}
                        value={item.en}
                        onChange={(e) => handleUpdateItem(item.id, { en: e.target.value })}
                        placeholder="Type English translation..."
                        className="w-full p-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs text-slate-900 transition-colors resize-y leading-relaxed font-sans"
                        dir="ltr"
                      />
                    </td>

                    {/* Single AI Translate Button */}
                    <td className="p-3 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => handleTranslateSingle(item)}
                        disabled={translatingId === item.id || isBatchTranslating}
                        className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 disabled:opacity-50 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer inline-flex items-center justify-center gap-1"
                        title="ترجمة هذا النص منفرداً بالذكاء الاصطناعي للتايلاندية والإنجليزية"
                      >
                        {translatingId === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
            <span>إجمالي النصوص المسجلة في هذا القسم: {filteredItems.length} نصوص</span>
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              حفظ
            </button>
          </div>
        </>
      )}
    </div>
  );
};
