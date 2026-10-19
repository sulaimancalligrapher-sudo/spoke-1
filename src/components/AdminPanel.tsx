import React, { useState } from 'react';
import {
  WordItem,
  GoogleSheetsConfig,
  StudentSubmissionRecord,
  EvaluationMode,
  PracticeCategory,
} from '../types';
import {
  BookOpen,
  Plus,
  Trash2,
  Table,
  Sparkles,
  Link2,
  CheckCircle2,
  Download,
  Upload,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  Search,
  Filter,
  Volume2,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Send,
  Sliders,
} from 'lucide-react';
import { removeTashkeel } from '../utils/arabicMatcher';
import {
  sendScoreToGoogleSheets,
  exportRecordsToCSV,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
} from '../utils/googleSheets';
import { speakArabicBrowser } from '../utils/arabicAudio';

interface AdminPanelProps {
  curriculum: WordItem[];
  onAddWord: (word: WordItem) => void;
  onDeleteWord: (id: string) => void;
  sheetsConfig: GoogleSheetsConfig;
  onUpdateSheetsConfig: (config: Partial<GoogleSheetsConfig>) => void;
  submissions: StudentSubmissionRecord[];
  onClearSubmissions: () => void;
  onBackToApp: () => void;
  defaultEvalMode: EvaluationMode;
  onUpdateDefaultEvalMode: (mode: EvaluationMode) => void;
}

const TASHKEEL_BUTTONS = [
  { char: '\u064E', label: 'ـَ', name: 'فتحة' },
  { char: '\u064F', label: 'ـُ', name: 'ضمة' },
  { char: '\u0650', label: 'ـِ', name: 'كسرة' },
  { char: '\u0652', label: 'ـْ', name: 'سكون' },
  { char: '\u0651', label: 'ـّ', name: 'شدة' },
  { char: '\u064B', label: 'ـً', name: 'تنوين فتح' },
  { char: '\u064C', label: 'ـٌ', name: 'تنوين ضم' },
  { char: '\u064D', label: 'ـٍ', name: 'تنوين كسر' },
  { char: '\u0670', label: 'ـٰ', name: 'ألف خنجرية' },
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  curriculum,
  onAddWord,
  onDeleteWord,
  sheetsConfig,
  onUpdateSheetsConfig,
  submissions,
  onClearSubmissions,
  onBackToApp,
  defaultEvalMode,
  onUpdateDefaultEvalMode,
}) => {
  const [activeTab, setActiveTab] = useState<'lessons' | 'sheets' | 'system' | 'submissions'>('lessons');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [testStatus, setTestStatus] = useState<{ loading: boolean; message: string; success?: boolean } | null>(null);

  // New Word Form State
  const [newWord, setNewWord] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [newCategory, setNewCategory] = useState<PracticeCategory>('words');
  const [newLevel, setNewLevel] = useState<number>(2);
  const [newLessonName, setNewLessonName] = useState('');
  const [newLetterFocus, setNewLetterFocus] = useState('');
  const [newMakhrajTip, setNewMakhrajTip] = useState('');

  const handleInsertTashkeel = (char: string) => {
    setNewWord((prev) => prev + char);
  };

  const handleAddNewWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;

    const wordItem: WordItem = {
      id: `admin-${Date.now()}`,
      word: newWord.trim(),
      plainWord: removeTashkeel(newWord.trim()),
      meaning: newMeaning.trim() || 'كلمة أضافها المعلم في الإدارة',
      category: newCategory,
      level: newLevel,
      makhrajTip: newMakhrajTip.trim() || 'انطق الكلمة بوضوح مع مراعاة الحركات المشكّلة.',
      letterFocus: newLetterFocus.trim() || newWord.trim()[0],
      lessonName: newLessonName.trim() || 'درس جديد',
    };

    onAddWord(wordItem);
    setNewWord('');
    setNewMeaning('');
    setNewLetterFocus('');
    setNewMakhrajTip('');
    alert('تمت إضافة الكلمة إلى منهج التطبيق بنجاح!');
  };

  const handleCopyScriptCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleTestSheetsConnection = async () => {
    if (!sheetsConfig.webhookUrl) {
      alert('يرجى إدخال رابط Google Sheets Webhook أولاً');
      return;
    }

    setTestStatus({ loading: true, message: 'جاري اختبار الإرسال إلى Google Sheets...' });

    const dummyRecord: StudentSubmissionRecord = {
      id: `test-${Date.now()}`,
      studentName: 'طالب تجريبي (اختبار)',
      word: 'اخْتِبَارٌ نَاجِحٌ',
      score: 100,
      grade: 'ممتاز',
      detectedWord: 'اختبار ناجح',
      feedback: 'هذا صف تجريبي للتأكد من اتصال فصيح مع Google Sheets بنجاح.',
      engineUsed: 'local',
      timestamp: Date.now(),
      syncedToSheets: false,
    };

    const res = await sendScoreToGoogleSheets(sheetsConfig.webhookUrl, dummyRecord);
    setTestStatus({
      loading: false,
      success: res.success,
      message: res.message,
    });
  };

  // Filtered curriculum items
  const filteredCurriculum = curriculum.filter(
    (c) =>
      c.word.includes(searchQuery) ||
      c.plainWord.includes(searchQuery) ||
      c.meaning.includes(searchQuery) ||
      (c.lessonName && c.lessonName.includes(searchQuery))
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-cairo flex flex-col">
      {/* Admin Top Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-900 flex items-center justify-center font-bold text-lg">
              ⚙
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold">
                  لوحة إدارة المعلم والدروس
                </h1>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                  رابط إداري مخصص
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                إدارة الكلمات، ربط Google Sheets، والتحكم بأنظمة التقييم
              </p>
            </div>
          </div>

          <button
            onClick={onBackToApp}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <span>العودة لصفحة الطالب</span>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
        </div>
      </header>

      {/* Main Admin Body */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col gap-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('lessons')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'lessons'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>إدارة الكلمات والدروس ({curriculum.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('sheets')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'sheets'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>ربط Google Sheets</span>
            {sheetsConfig.enabled && sheetsConfig.webhookUrl && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'system'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>نظاما التقييم (داخلي / ذكاء اصطناعي)</span>
          </button>

          <button
            onClick={() => setActiveTab('submissions')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'submissions'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>سجل نتائج الطلاب ({submissions.length})</span>
          </button>
        </div>

        {/* TAB 1: LESSONS & WORDS MANAGEMENT */}
        {activeTab === 'lessons' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Add Word Form (5 cols) */}
            <div className="lg:col-span-5 bg-white rounded-3xl p-6 shadow-md border border-slate-100">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">إضافة كلمة أو تدريب جديد</h3>
                  <p className="text-[11px] text-slate-500">ستظهر مباشرة في قائمة تدريب الطلاب</p>
                </div>
              </div>

              <form onSubmit={handleAddNewWord} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الكلمة أو الجملة (بالتشكيل الكامل):
                  </label>
                  <input
                    type="text"
                    required
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    placeholder="مثال: الْقَمَرُ، كَتَبَ، قَلْبٌ..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-amiri text-2xl text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {/* Quick Tashkeel Toolbar */}
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                  <span className="block text-[11px] font-bold text-slate-600 mb-1.5">
                    شريط حركات التشكيل السريع:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {TASHKEEL_BUTTONS.map((t) => (
                      <button
                        key={t.char}
                        type="button"
                        onClick={() => handleInsertTashkeel(t.char)}
                        className="px-2.5 py-1 bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-lg font-amiri text-base font-bold text-slate-800 transition-colors shadow-2xs cursor-pointer"
                        title={t.name}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      المستوى:
                    </label>
                    <select
                      value={newLevel}
                      onChange={(e) => setNewLevel(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden"
                    >
                      <option value={1}>المستوى 1: حروف ومخارج</option>
                      <option value={2}>المستوى 2: كلمات ثلاثية</option>
                      <option value={3}>المستوى 3: مقارنة الحروف</option>
                      <option value={4}>المستوى 4: جمل فصيحة</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      الفئة:
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden"
                    >
                      <option value="words">كلمات</option>
                      <option value="letters">حروف ومخارج</option>
                      <option value="minimal-pairs">مقارنة حروف متقاربة</option>
                      <option value="sentences">جمل</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اسم الدرس أو الوحدة التعليمية:
                  </label>
                  <input
                    type="text"
                    value={newLessonName}
                    onChange={(e) => setNewLessonName(e.target.value)}
                    placeholder="مثال: درس حرف الضاد، كلمات الفتحة..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    المعنى أو التوضيح:
                  </label>
                  <input
                    type="text"
                    value={newMeaning}
                    onChange={(e) => setNewMeaning(e.target.value)}
                    placeholder="مثال: اسم يدل على جرم سماوي منير..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    إرشاد المخرج الصوتي (نصيحة للطالب):
                  </label>
                  <textarea
                    rows={2}
                    value={newMakhrajTip}
                    onChange={(e) => setNewMakhrajTip(e.target.value)}
                    placeholder="مثال: احرص على ملامسة حافة اللسان للأضراس العليا لتفخيم الضاد..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-emerald-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة الكلمة للمنهج</span>
                </button>
              </form>
            </div>

            {/* Existing Words Table (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-md border border-slate-100 flex flex-col">
              <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    قائمة الكلمات والدروس الحالية ({curriculum.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    يمكنك البحث، الاستماع للنطق، أو حذف الكلمات المخصصة
                  </p>
                </div>

                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث في الكلمات..."
                    className="w-full pl-2 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[520px] space-y-2 pr-1">
                {filteredCurriculum.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 border border-slate-200/70 rounded-2xl flex items-center justify-between gap-3 hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => speakArabicBrowser(item.word, 0.85)}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50 flex items-center justify-center shrink-0 cursor-pointer shadow-2xs"
                        title="استمع للكلمة"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>

                      <div className="min-w-0">
                        <div className="font-amiri text-xl font-bold text-slate-900 truncate">
                          {item.word}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="px-2 py-0.5 bg-slate-200/80 rounded-md text-[10px]">
                            المستوى {item.level}
                          </span>
                          <span className="truncate max-w-[200px]">{item.meaning}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.id.startsWith('admin-') || item.id.startsWith('custom-') ? (
                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف "${item.word}"؟`)) {
                              onDeleteWord(item.id);
                            }
                          }}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="حذف هذه الكلمة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold">
                          أساسي
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GOOGLE SHEETS INTEGRATION */}
        {activeTab === 'sheets' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-100 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    ربط التطبيق بجدول Google Sheets لحفظ درجات الطلاب
                  </h3>
                  <p className="text-xs text-slate-500">
                    طريقة سريعة، مجانية 100% للأبد، وتعمل على Vercel و GitHub بدون أي سيرفر
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleTestSheetsConnection}
                  disabled={testStatus?.loading}
                  className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{testStatus?.loading ? 'جاري الاختبار...' : 'إرسال صف تجريبي'}</span>
                </button>
              </div>
            </div>

            {testStatus && (
              <div
                className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
                  testStatus.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {testStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                )}
                <span>{testStatus.message}</span>
              </div>
            )}

            {/* Webhook Configuration Inputs */}
            <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  رابط Google Sheets Webhook (رابط تطبيق الويب):
                </label>
                <input
                  type="url"
                  value={sheetsConfig.webhookUrl}
                  onChange={(e) =>
                    onUpdateSheetsConfig({
                      webhookUrl: e.target.value,
                      enabled: !!e.target.value.trim(),
                    })
                  }
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-hidden focus:border-emerald-500 dir-ltr text-left"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  انسخ الرابط الناتج من خطوة نشر الـ Apps Script وضعه هنا.
                </span>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    تفعيل التسجيل التلقائي فور انتهاء كل نطق
                  </div>
                  <div className="text-[11px] text-slate-500">
                    عندما ينتهي الطالب من نطق الكلمة، تُسجل درجته واسمه مباشرة في جدولك
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={sheetsConfig.autoSync}
                  onChange={(e) => onUpdateSheetsConfig({ autoSync: e.target.checked })}
                  className="w-5 h-5 text-emerald-600 rounded-sm focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Quick 2-Minute Setup Instructions */}
            <div className="border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>خطوات الربط السريعة مع جدولك (تستغرق دقيقة واحدة):</span>
                </div>
                <button
                  onClick={handleCopyScriptCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">تم نسخ الكود!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ كود الربط</span>
                    </>
                  )}
                </button>
              </div>

              <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 leading-relaxed pr-1">
                <li>افتح جدول بيانات جديد في Google Sheets وسمّه مثلاً: "درجات فصيح".</li>
                <li>من القائمة العلوية: اضغط على <strong>التطبيقات الملحقة (Extensions)</strong> ثم <strong>Apps Script</strong>.</li>
                <li>امسح ما بداخل الملف والصق الكود الذي نسخته بالزر أعلاه.</li>
                <li>اضغط على الزر الأزرق بالأعلى: <strong>نشر (Deploy)</strong> ثم <strong>نشر جديد (New deployment)</strong>.</li>
                <li>اختر النوع: <strong>تطبيق ويب (Web app)</strong>، واجعل صلاحية الوصول: <strong>أي شخص (Anyone)</strong>.</li>
                <li>انسخ رابط الويب الناتج والصقه في خانة الرابط أعلاه! انتهى الربط بنجاح.</li>
              </ol>

              {/* Code preview box */}
              <div className="relative mt-2">
                <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-36 dir-ltr text-left">
                  {GOOGLE_APPS_SCRIPT_TEMPLATE}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DUAL EVALUATION SYSTEM SETTINGS */}
        {activeTab === 'system' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-100 space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                التحكم بنظامي التقييم (النظام الداخلي والذكاء الاصطناعي)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                حدد النظام الافتراضي لكل الطلاب وفق متطلباتك
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mode 1: Local / Internal */}
              <div
                onClick={() => onUpdateDefaultEvalMode('local')}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative ${
                  defaultEvalMode === 'local'
                    ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {defaultEvalMode === 'local' && (
                  <span className="absolute top-4 left-4 px-2 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-bold">
                    الافتراضي الحالي
                  </span>
                )}
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold mb-3">
                  ⚡
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">
                  النظام الأول: التقييم الداخلي السريع (الأساسي)
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  يعمل بالكامل داخل متصفح الطالب عبر خوارزميات صوتية مدمجة. 
                </p>
                <ul className="mt-3 space-y-1 text-[11px] text-emerald-800 font-medium">
                  <li>✓ مجاني 100% للأبد وبدون أي حدود أو اشتراك</li>
                  <li>✓ فوري ولحظي (0.1 ثانية) ولا يحتاج لسيرفر خارجي</li>
                  <li>✓ يعمل بكفاءة عالية عند الرفع على Vercel و GitHub</li>
                </ul>
              </div>

              {/* Mode 2: AI Gemini */}
              <div
                onClick={() => onUpdateDefaultEvalMode('ai')}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative ${
                  defaultEvalMode === 'ai'
                    ? 'border-indigo-500 bg-indigo-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {defaultEvalMode === 'ai' && (
                  <span className="absolute top-4 left-4 px-2 py-0.5 bg-indigo-600 text-white rounded-full text-[10px] font-bold">
                    الافتراضي الحالي
                  </span>
                )}
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold mb-3">
                  ✨
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">
                  النظام الثاني: تقييم الذكاء الاصطناعي (Gemini)
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  يحلل الصوت عبر الذكاء الاصطناعي ويوفر نصائح مفصلة للسان والمخارج.
                </p>
                <ul className="mt-3 space-y-1 text-[11px] text-indigo-800 font-medium">
                  <li>✓ مخصص للحالات الخاصة والتغذية الراجعة المعمقة</li>
                  <li>✓ مجاني حتى 1,500 تقييم يومياً عبر باقة Google المجانية</li>
                  <li>✓ يستطيع الطالب اختياره عند الحاجة بضغطة زر</li>
                </ul>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 leading-relaxed">
              <strong>💡 نصيحة للمعلم:</strong> يُفضل ترك <strong>"التقييم الداخلي"</strong> هو الأساسي لضمان سرعة فائقة للطلاب ومجانية أبدية بدون استهلاك أي باقة، مع إمكانية تحويل أي نطق إلى الذكاء الاصطناعي بنقرة واحدة عند رغبة الطالب.
            </div>
          </div>
        )}

        {/* TAB 4: SUBMISSIONS LOG */}
        {activeTab === 'submissions' && (
          <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-100 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  سجل استجابات ودرجات الطلاب ({submissions.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  يمكنك استعراض الدرجات وتصديرها لملف Excel بضغطة زر
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportRecordsToCSV(submissions)}
                  disabled={submissions.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير إلى Excel / CSV</span>
                </button>

                {submissions.length > 0 && (
                  <button
                    onClick={onClearSubmissions}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    title="مسح السجل"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {submissions.length === 0 ? (
              <div className="text-center py-16 text-xs text-slate-400">
                لم يتم تسجيل أي درجات بعد. عندما يتدرب الطلاب ستظهر درجاتهم هنا تلقائياً وتُرسل لـ Google Sheets.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <th className="p-3">الوقت</th>
                      <th className="p-3">اسم الطالب</th>
                      <th className="p-3">الكلمة</th>
                      <th className="p-3">الدرجة</th>
                      <th className="p-3">التقدير</th>
                      <th className="p-3">ما نطق به</th>
                      <th className="p-3">نوع التقييم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {submissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/70">
                        <td className="p-3 text-[11px] text-slate-400">
                          {new Date(sub.timestamp).toLocaleTimeString('ar-SA', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="p-3 font-bold text-slate-800">
                          {sub.studentName || 'طالب'}
                        </td>
                        <td className="p-3 font-amiri text-base font-bold text-emerald-800">
                          {sub.word}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                              sub.score >= 85
                                ? 'bg-emerald-100 text-emerald-800'
                                : sub.score >= 70
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {sub.score}%
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{sub.grade}</td>
                        <td className="p-3 font-amiri text-slate-700">{sub.detectedWord || '—'}</td>
                        <td className="p-3 text-[11px] text-slate-500">
                          {sub.engineUsed === 'ai' ? 'ذكاء اصطناعي' : 'داخلي'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
