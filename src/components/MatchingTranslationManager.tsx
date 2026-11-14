import React, { useEffect, useMemo, useState } from 'react';
import {
  TranslationItem,
  DEFAULT_TRANSLATIONS,
  translateSingleWithAI,
  translateBatchWithAI,
  getMatchingSubjectTranslationId,
  getMatchingQuestionTranslationId,
} from '../utils/translations';
import { MatchingLessonSubject } from '../types';
import { getQuestionPlainText, parseQuestionBlocks } from '../utils/matchingMedia';
import {
  ensureTranslationsSheet,
  saveTranslationsToSheets,
} from '../utils/googleSheets';
import {
  Languages,
  Sparkles,
  Save,
  Check,
  Search,
  RefreshCw,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  Image as ImageIcon,
  Volume2,
} from 'lucide-react';

interface MatchingTranslationManagerProps {
  translations: TranslationItem[];
  onSaveTranslations: (updated: TranslationItem[]) => void;
  matchingSubjects: MatchingLessonSubject[];
  geminiApiKey?: string;
  webhookUrl?: string;
  onRefreshFromSheets?: () => Promise<void>;
}

type MatchingTransSubTab = 'ui' | 'subjects' | 'questions';

export const MatchingTranslationManager: React.FC<MatchingTranslationManagerProps> = ({
  translations,
  onSaveTranslations,
  matchingSubjects,
  geminiApiKey,
  webhookUrl,
  onRefreshFromSheets,
}) => {
  const [subTab, setSubTab] = useState<MatchingTransSubTab>('ui');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');

  // Build isolated working list for Exercise 2 (UI + Subjects + Questions)
  const buildMatchingItems = (
    baseList: TranslationItem[],
    subjects: MatchingLessonSubject[]
  ): TranslationItem[] => {
    const map = new Map<string, TranslationItem>();

    // 1. Ensure all default matching UI items exist
    DEFAULT_TRANSLATIONS.filter((d) => d.category === 'matching').forEach((d) => {
      map.set(d.id, d);
    });

    // 2. Overlay any saved matching items from baseList
    baseList.forEach((item) => {
      if (
        item.category === 'matching' ||
        item.id.startsWith('matching_') ||
        item.id.startsWith('stats_tab_') ||
        item.id.startsWith('stats_matching_')
      ) {
        const existing = map.get(item.id);
        map.set(
          item.id,
          existing
            ? {
                ...existing,
                ar: item.ar !== undefined ? item.ar : existing.ar,
                th: item.th !== undefined ? item.th : existing.th,
                en: item.en !== undefined ? item.en : existing.en,
              }
            : { ...item, category: 'matching' }
        );
      }
    });

    // 3. Dynamic Subject names from sheet "وصل"
    subjects.forEach((subj) => {
      const cleanName = (subj.subjectName || '').trim();
      if (!cleanName) return;
      const subjId = getMatchingSubjectTranslationId(cleanName);
      const existing = map.get(subjId);
      const note = `موضوع درس وصل (${subj.exercises.length} تمارين)`;
      if (!existing) {
        map.set(subjId, {
          id: subjId,
          category: 'matching',
          categoryLabel: 'أسماء مواضيع دروس وصل',
          ar: cleanName,
          th: '',
          en: '',
          isSheetLinked: true,
          sheetSourceNote: note,
        });
      } else {
        map.set(subjId, {
          ...existing,
          category: 'matching',
          categoryLabel: 'أسماء مواضيع دروس وصل',
          isSheetLinked: true,
          sheetSourceNote: note,
          ar: existing.ar?.trim() ? existing.ar : cleanName,
        });
      }

      // 4. Dynamic Question plain text for each exercise (cards stay untouched in Arabic!)
      subj.exercises.forEach((ex) => {
        const plainQ = getQuestionPlainText(ex.questionText);
        // Only register textual questions (ignore placeholder if completely empty or pure media without text)
        const hasTextBlock = parseQuestionBlocks(ex.questionText).some(
          (b) => b.type === 'text' && b.value.trim()
        );
        if (!hasTextBlock || !plainQ) return;

        const qId = getMatchingQuestionTranslationId(cleanName, ex.exerciseNumber);
        const existingQ = map.get(qId);
        const qNote = `[${cleanName}] تمرين ${ex.exerciseNumber}`;
        if (!existingQ) {
          map.set(qId, {
            id: qId,
            category: 'matching',
            categoryLabel: 'نصوص أسئلة تمرين الوصل',
            ar: plainQ,
            th: '',
            en: '',
            isSheetLinked: true,
            sheetSourceNote: qNote,
          });
        } else {
          map.set(qId, {
            ...existingQ,
            category: 'matching',
            categoryLabel: 'نصوص أسئلة تمرين الوصل',
            isSheetLinked: true,
            sheetSourceNote: qNote,
            ar: existingQ.ar?.trim() ? existingQ.ar : plainQ,
          });
        }
      });
    });

    return Array.from(map.values());
  };

  const [matchingItems, setMatchingItems] = useState<TranslationItem[]>(() =>
    buildMatchingItems(translations, matchingSubjects)
  );

  // Sync whenever matchingSubjects or external translations update
  useEffect(() => {
    setMatchingItems(buildMatchingItems(translations, matchingSubjects));
  }, [translations, matchingSubjects]);

  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [isBatchTranslating, setIsBatchTranslating] = useState(false);
  const [isSyncingToSheets, setIsSyncingToSheets] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [sheetSyncStatus, setSheetSyncStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const uiItems = useMemo(
    () =>
      matchingItems.filter(
        (i) => !i.id.startsWith('matching_subj_') && !i.id.startsWith('matching_q_')
      ),
    [matchingItems]
  );

  const subjectItems = useMemo(
    () => matchingItems.filter((i) => i.id.startsWith('matching_subj_')),
    [matchingItems]
  );

  const questionItems = useMemo(
    () => matchingItems.filter((i) => i.id.startsWith('matching_q_')),
    [matchingItems]
  );

  const currentTabItems = useMemo(() => {
    let list =
      subTab === 'ui'
        ? uiItems
        : subTab === 'subjects'
        ? subjectItems
        : questionItems;

    if (subTab === 'questions' && selectedSubjectFilter !== 'all') {
      list = list.filter(
        (i) =>
          i.sheetSourceNote &&
          i.sheetSourceNote.includes(`[${selectedSubjectFilter}]`)
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.id.toLowerCase().includes(q) ||
          item.ar.toLowerCase().includes(q) ||
          item.th.toLowerCase().includes(q) ||
          item.en.toLowerCase().includes(q) ||
          (item.sheetSourceNote && item.sheetSourceNote.toLowerCase().includes(q))
      );
    }

    return list;
  }, [subTab, uiItems, subjectItems, questionItems, selectedSubjectFilter, searchQuery]);

  const mergeWithPrimaryTranslations = (nextMatching: TranslationItem[]): TranslationItem[] => {
    const map = new Map<string, TranslationItem>();
    // Preserve all Exercise 1 & shared translations untouched
    translations.forEach((item) => map.set(item.id, item));
    // Apply updated Exercise 2 translations
    nextMatching.forEach((item) => map.set(item.id, item));
    return Array.from(map.values());
  };

  const handleUpdateItem = (id: string, patch: Partial<TranslationItem>) => {
    setMatchingItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const handleTranslateSingle = async (item: TranslationItem) => {
    if (!item.ar || !item.ar.trim()) {
      alert('يرجى وجود النص العربي أولاً ليتم ترجمته بالذكاء الاصطناعي.');
      return;
    }
    setTranslatingId(item.id);
    setStatusMessage('جاري استدعاء الذكاء الاصطناعي لترجمة النص...');
    try {
      const result = await translateSingleWithAI(item.ar, geminiApiKey);
      handleUpdateItem(item.id, {
        th: result.th !== undefined ? result.th : item.th,
        en: result.en !== undefined ? result.en : item.en,
      });
      setStatusMessage(`✨ تم ترجمة "${item.ar.slice(0, 30)}" بنجاح`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (e: any) {
      alert('تعذر الترجمة: ' + (e?.message || 'تأكد من الاتصال'));
    } finally {
      setTranslatingId(null);
    }
  };

  const handleTranslateBatchInCurrentTab = async () => {
    const targets = currentTabItems.filter((i) => i.ar && i.ar.trim());
    if (targets.length === 0) return;

    if (
      !confirm(
        `هل تريد ترجمة جميع نصوص هذا التبويب (${targets.length} نصاً) إلى التايلاندية والإنجليزية بالذكاء الاصطناعي دفعة واحدة؟`
      )
    ) {
      return;
    }

    setIsBatchTranslating(true);
    setStatusMessage(`جاري ترجمة ${targets.length} نصاً بالذكاء الاصطناعي...`);
    try {
      const batchPayload = targets.map((i) => ({ id: i.id, text: i.ar }));
      const results = await translateBatchWithAI(batchPayload, geminiApiKey);
      setMatchingItems((prev) =>
        prev.map((item) => {
          const r = results[item.id];
          if (!r) return item;
          return {
            ...item,
            th: r.th !== undefined && r.th !== '' ? r.th : item.th,
            en: r.en !== undefined && r.en !== '' ? r.en : item.en,
          };
        })
      );
      setStatusMessage('🎉 اكتملت الترجمة الجماعية بنجاح! اضغط "حفظ ومزامنة في ورقة الترجمة" لتثبيت النتائج.');
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (e: any) {
      alert('تعذر إكمال الترجمة الجماعية: ' + (e?.message || 'خطأ في الاتصال'));
    } finally {
      setIsBatchTranslating(false);
    }
  };

  const handleSaveAndSyncAll = async () => {
    const merged = mergeWithPrimaryTranslations(matchingItems);
    onSaveTranslations(merged);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);

    if (webhookUrl && webhookUrl.trim().startsWith('http')) {
      setIsSyncingToSheets(true);
      setSheetSyncStatus(null);
      try {
        const res = await saveTranslationsToSheets(webhookUrl, merged);
        setSheetSyncStatus(res);
      } catch (e: any) {
        setSheetSyncStatus({
          success: false,
          message: 'تم الحفظ محلياً، وتعذرت المزامنة مع ورقة الترجمة: ' + (e?.message || ''),
        });
      } finally {
        setIsSyncingToSheets(false);
      }
    } else {
      setStatusMessage('✓ تم حفظ ترجمات تمرين التوصيل في المتصفح!');
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleRefreshFromSheet = async () => {
    if (!onRefreshFromSheets) return;
    setIsRefreshing(true);
    try {
      await onRefreshFromSheets();
      setStatusMessage('✓ تم جلب أحدث التمارين والترجمات من Google Sheets!');
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEnsureSheet = async () => {
    if (!webhookUrl) {
      alert('يرجى إدخال رابط Google Sheets Webhook أولاً في الإعدادات.');
      return;
    }
    setIsSyncingToSheets(true);
    const merged = mergeWithPrimaryTranslations(matchingItems);
    const res = await ensureTranslationsSheet(webhookUrl, merged);
    setIsSyncingToSheets(false);
    setSheetSyncStatus(res);
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-md border border-purple-100/90 space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <Languages className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              إدارة وتخصيص الترجمة 2 — تمرين وصل الكلمات
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              مخصص لترجمة واجهة التوصيل، أسماء مواضيع الدروس، ونصوص الأسئلة فقط (تبقى البطاقات العربية كما هي دون ترجمة)
            </p>
          </div>
        </div>

        {/* Save / Sync / Batch AI Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {onRefreshFromSheets && (
            <button
              type="button"
              onClick={handleRefreshFromSheet}
              disabled={isRefreshing || isSyncingToSheets}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              title="سحب أحدث التمارين والترجمات من Google Sheets"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>تحديث من الشيت</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleTranslateBatchInCurrentTab}
            disabled={isBatchTranslating || currentTabItems.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            {isBatchTranslating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            )}
            <span>ترجمة القسم بالذكاء الاصطناعي ({currentTabItems.length})</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAndSyncAll}
            disabled={isSyncingToSheets}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
              savedSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {isSyncingToSheets ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : savedSuccess ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{savedSuccess ? 'تم الحفظ والمزامنة!' : 'حفظ ومزامنة في ورقة الترجمة'}</span>
          </button>
        </div>
      </div>

      {/* Status & Sync Banners */}
      {statusMessage && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {sheetSyncStatus && (
        <div
          className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in ${
            sheetSyncStatus.success
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {sheetSyncStatus.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{sheetSyncStatus.message}</span>
          </div>
          {!sheetSyncStatus.success && webhookUrl && (
            <button
              type="button"
              onClick={handleEnsureSheet}
              className="px-3 py-1 bg-white border border-rose-300 rounded-lg text-[11px] font-bold text-rose-800 hover:bg-rose-100 cursor-pointer flex items-center gap-1"
            >
              <FileSpreadsheet className="w-3 h-3" />
              <span>تجهيز ورقة الترجمة</span>
            </button>
          )}
        </div>
      )}

      {/* Sub-Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
        <button
          type="button"
          onClick={() => {
            setSubTab('ui');
            setSearchQuery('');
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === 'ui'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Languages className="w-3.5 h-3.5" />
          <span>واجهة ورسائل التوصيل ({uiItems.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('subjects');
            setSearchQuery('');
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === 'subjects'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>أسماء الدروس ({subjectItems.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('questions');
            setSearchQuery('');
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === 'questions'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>نصوص الأسئلة ({questionItems.length})</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80">
        <div className="flex flex-wrap items-center gap-2">
          {subTab === 'questions' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
                📚 تصفية بالموضوع:
              </span>
              <select
                value={selectedSubjectFilter}
                onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-purple-500 cursor-pointer shadow-2xs"
              >
                <option value="all">جميع الدروس ({questionItems.length})</option>
                {matchingSubjects.map((s) => (
                  <option key={s.id} value={s.subjectName}>
                    {s.subjectName}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="text-xs font-semibold text-slate-500">
              {subTab === 'ui'
                ? 'أزرار التوصيل، رسائل التوجيه والتصحيح، سجل التوصيل، وقائمة دروس الوصل'
                : 'أسماء مواضيع الدروس القادمة من ورقة "وصل" (تظهر للطالب حسب لغته المختارة)'}
            </span>
          )}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في نصوص تمرين الوصل..."
            className="w-full pr-8 pl-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-purple-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Translations Table */}
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
            {currentTabItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-400 text-xs">
                  لا توجد نصوص مطابقة للعرض في هذا القسم.
                </td>
              </tr>
            ) : (
              currentTabItems.map((item) => {
                // Check if question item has attached media in matchingSubjects
                let hasImageMedia = false;
                let hasAudioMedia = false;
                if (item.id.startsWith('matching_q_')) {
                  for (const subj of matchingSubjects) {
                    for (const ex of subj.exercises) {
                      if (getMatchingQuestionTranslationId(subj.subjectName, ex.exerciseNumber) === item.id) {
                        const blocks = parseQuestionBlocks(ex.questionText);
                        hasImageMedia = blocks.some((b) => b.type === 'image');
                        hasAudioMedia = blocks.some((b) => b.type === 'audio');
                      }
                    }
                  }
                }

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 align-top">
                      <textarea
                        rows={2}
                        value={item.ar}
                        onChange={(e) => handleUpdateItem(item.id, { ar: e.target.value })}
                        readOnly={item.id.startsWith('matching_subj_') || item.id.startsWith('matching_q_')}
                        className={`w-full p-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 transition-colors resize-y leading-relaxed font-cairo ${
                          item.id.startsWith('matching_subj_') || item.id.startsWith('matching_q_')
                            ? 'bg-slate-100/80 text-slate-700 cursor-default'
                            : 'bg-slate-50 hover:bg-white focus:bg-white focus:border-purple-500'
                        }`}
                        dir="rtl"
                      />
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        <span className="text-[10px] text-slate-400 font-mono truncate max-w-[160px]" title={item.id}>
                          {item.id}
                        </span>
                        {item.sheetSourceNote && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded-md text-[9px] font-bold">
                            🔗 {item.sheetSourceNote}
                          </span>
                        )}
                        {hasImageMedia && (
                          <span className="px-1.5 py-0.5 bg-sky-100 text-sky-800 rounded-md text-[9px] font-bold inline-flex items-center gap-0.5">
                            <ImageIcon className="w-2.5 h-2.5" />
                            <span>صورة محفوظة</span>
                          </span>
                        )}
                        {hasAudioMedia && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[9px] font-bold inline-flex items-center gap-0.5">
                            <Volume2 className="w-2.5 h-2.5" />
                            <span>صوت محفوظ</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 align-top">
                      <textarea
                        rows={2}
                        value={item.th}
                        onChange={(e) => handleUpdateItem(item.id, { th: e.target.value })}
                        placeholder="พิมพ์คำแปลภาษาไทย..."
                        className="w-full p-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-purple-500 rounded-xl text-xs text-slate-900 transition-colors resize-y leading-relaxed font-sans"
                        dir="ltr"
                      />
                    </td>

                    <td className="p-3 align-top">
                      <textarea
                        rows={2}
                        value={item.en}
                        onChange={(e) => handleUpdateItem(item.id, { en: e.target.value })}
                        placeholder="Type English translation..."
                        className="w-full p-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-purple-500 rounded-xl text-xs text-slate-900 transition-colors resize-y leading-relaxed font-sans"
                        dir="ltr"
                      />
                    </td>

                    <td className="p-3 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => handleTranslateSingle(item)}
                        disabled={translatingId === item.id || isBatchTranslating}
                        className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-700 disabled:opacity-50 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer inline-flex items-center justify-center"
                        title="ترجمة هذا النص بالذكاء الاصطناعي"
                      >
                        {translatingId === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-purple-600" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Save Action */}
      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <span>إجمالي نصوص هذا التبويب: {currentTabItems.length} نص</span>
        <button
          type="button"
          onClick={handleSaveAndSyncAll}
          disabled={isSyncingToSheets}
          className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
        >
          حفظ ومزامنة في ورقة الترجمة
        </button>
      </div>
    </div>
  );
};
