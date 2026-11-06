import React, { useState } from 'react';
import {
  TranslationItem,
  SupportedLang,
  translateSingleWithAI,
  translateBatchWithAI,
} from '../utils/translations';
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
} from 'lucide-react';

interface TranslationManagerProps {
  translations: TranslationItem[];
  onSaveTranslations: (updated: TranslationItem[]) => void;
  geminiApiKey?: string;
  webhookUrl?: string;
}

export const TranslationManager: React.FC<TranslationManagerProps> = ({
  translations,
  onSaveTranslations,
  geminiApiKey,
  webhookUrl,
}) => {
  const [items, setItems] = useState<TranslationItem[]>(translations);
  const [activeTab, setActiveTab] = useState<'home' | 'lessons' | 'practice'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [isBatchTranslating, setIsBatchTranslating] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const filteredItems = items.filter((item) => {
    if (item.category !== activeTab) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      item.id.toLowerCase().includes(q) ||
      item.ar.toLowerCase().includes(q) ||
      item.th.toLowerCase().includes(q) ||
      item.en.toLowerCase().includes(q)
    );
  });

  const handleUpdateItem = (id: string, updates: Partial<TranslationItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleTranslateSingle = async (item: TranslationItem) => {
    setTranslatingId(item.id);
    setStatusMessage(null);
    try {
      const result = await translateSingleWithAI(item.ar, geminiApiKey);
      handleUpdateItem(item.id, {
        th: result.th || item.th,
        en: result.en || item.en,
      });
      setStatusMessage(`✨ تم ترجمة "${item.ar}" بالذكاء الاصطناعي بنجاح`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e: any) {
      alert('تعذر الترجمة بالذكاء الاصطناعي: ' + (e?.message || 'تأكد من الاتصال'));
    } finally {
      setTranslatingId(null);
    }
  };

  const handleTranslateAllInTab = async () => {
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
              th: results[item.id].th || item.th,
              en: results[item.id].en || item.en,
            };
          }
          return item;
        })
      );
      setStatusMessage(`🎉 تم ترجمة جميع نصوص قسم (${activeTab}) بالذكاء الاصطناعي بنجاح! لا تنسَ حفظ التعديلات.`);
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (e: any) {
      alert('تعذر إكمال الترجمة الجماعية: ' + (e?.message || 'خطأ في الاتصال'));
    } finally {
      setIsBatchTranslating(false);
    }
  };

  const handleSaveAll = () => {
    onSaveTranslations(items);
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
          <button
            type="button"
            onClick={handleTranslateAllInTab}
            disabled={isBatchTranslating}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="ترجمة جماعية لجميع نصوص هذا التبويب بالذكاء الاصطناعي"
          >
            {isBatchTranslating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>جاري الترجمة الجماعية...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>ترجمة جماعية للقسم بالذكاء الاصطناعي ✨</span>
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
                <span>تم الحفظ بنجاح!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>حفظ التعديلات</span>
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

      {/* Category Tabs: The 3 user-specified locations */}
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
            ٢- صفحة الدروس ({items.filter((i) => i.category === 'lessons').length})
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
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
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
            {filteredItems.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                {/* Arabic Column */}
                <td className="p-3 align-top">
                  <div className="font-bold text-slate-900 leading-snug">{item.ar}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">ID: {item.id}</div>
                  {item.isSheetLinked && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold">
                      🔗 {item.sheetSourceNote || 'متصل بالشيت'}
                    </span>
                  )}
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
          حفظ وتفعيل في واجهة الطلاب
        </button>
      </div>
    </div>
  );
};
