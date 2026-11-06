import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Zap,
  Headphones,
  Sliders,
  ShieldCheck,
  BookOpen,
  Mic,
  Volume2,
  CheckCircle,
  Settings,
  Gauge,
  Key,
  CheckCircle2,
} from 'lucide-react';
import { AudioSettings, EvaluationMode } from '../types';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: AudioSettings;
  onUpdateSettings?: (newSettings: Partial<AudioSettings>) => void;
  defaultEvalMode?: EvaluationMode;
  onUpdateDefaultEvalMode?: (mode: EvaluationMode) => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  defaultEvalMode,
  onUpdateDefaultEvalMode,
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'methodology' | 'steps' | 'settings'>('notes');
  const [apiKeyInput, setApiKeyInput] = useState(settings?.geminiApiKey || '');
  const [keySaved, setKeySaved] = useState(false);

  if (!isOpen) return null;

  const handleSaveKey = () => {
    if (onUpdateSettings) {
      onUpdateSettings({ geminiApiKey: apiKeyInput.trim() });
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute left-5 top-5 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
            <Sparkles className="w-6 h-6 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              دليل ومواصفات منصة (فَصِيح)
            </h3>
            <p className="text-xs text-slate-500">
              الدليل الشامل للتقنيات، خطوات التدريب، وإعدادات الصوت ومحركات التقييم
            </p>
          </div>
        </div>

        {/* Tab switcher: 4 Unified Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-2xl mb-4">
          <button
            onClick={() => setActiveTab('notes')}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
              activeTab === 'notes'
                ? 'bg-white text-emerald-900 shadow-xs ring-1 ring-emerald-500/20'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📌 ملاحظات أساسية
          </button>
          <button
            onClick={() => setActiveTab('methodology')}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
              activeTab === 'methodology'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ⚙️ أركان التقييم
          </button>
          <button
            onClick={() => setActiveTab('steps')}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
              activeTab === 'steps'
                ? 'bg-white text-emerald-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🎯 خطوات التدريب
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
              activeTab === 'settings'
                ? 'bg-white text-teal-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🎛️ الصوت والتقييم
          </button>
        </div>

        {/* Tab 0: Essential Notes & Important Guidelines */}
        {activeTab === 'notes' && (
          <div className="space-y-3.5 my-3 animate-in fade-in duration-200">
            {/* Note 1: Whisper engine prominence */}
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-300 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Zap className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-emerald-950 text-sm flex items-center gap-1.5">
                  <span>📌 ملاحظة هامة:</span>
                  <span className="text-xs bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full font-bold">المحرك الأساسي المعتمد</span>
                </h4>
                <p className="text-xs text-emerald-900 leading-relaxed font-semibold">
                  تقييم نطق الطالب يعتمد بالدرجة الأولى على نموذج <strong className="text-emerald-950 underline">Whisper الداخلي</strong> (يعمل 100% داخل المتصفح بدون مفاتيح وبدون أي تكلفة أو استهلاك رصيد).
                </p>
              </div>
            </div>

            {/* Note 2: Gemini API in current environment */}
            <div className="p-4 bg-indigo-50/80 rounded-2xl border border-indigo-200 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-indigo-950 text-sm">
                  🔹 بيئة العمل السحابية الحالية:
                </h4>
                <p className="text-xs text-indigo-900 leading-relaxed">
                  <strong>لا يلزم إدخال المفتاح نهائياً في بيئة العمل الحالية:</strong> لأن الخادم الخلفي للتطبيق (server.ts) متصل تلقائياً ببيئة AI Studio التي توفر مفتاح Gemini API مباشرة في متغيرات البيئة.
                </p>
              </div>
            </div>

            {/* Note 3: Stored in localStorage */}
            <div className="p-4 bg-sky-50/80 rounded-2xl border border-sky-200 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sky-950 text-sm">
                  🔹 حفظ المفتاح في المتصفح:
                </h4>
                <p className="text-xs text-sky-900 leading-relaxed">
                  <strong>إذا أدخلت مفتاحاً في حقل الإعدادات:</strong> يُحفظ مباشرة في ذاكرة المتصفح localStorage ولن تحتاج لكتابته مجدداً؛ يظل محفوظاً على جهازك تلقائياً.
                </p>
              </div>
            </div>

            {/* Note 4: Optional for Vercel/Static */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-300 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sliders className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">
                  🔹 مرونة النشر الخارجي:
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed">
                  <strong>حقل الإعدادات اختياري فقط:</strong> تم تصميمه كخيار مرن لمن يريد تشغيل الموقع على استضافة خارجية ثابتة مثل Vercel بدون خادم وسيط.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Methodology */}
        {activeTab === 'methodology' && (
          <div className="space-y-3.5 my-3 animate-in fade-in duration-200">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-cyan-700" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">
                  1. الذكاء الاصطناعي الداخلي (Whisper WebAssembly)
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  يعمل المحرك مباشرة داخل متصفح جهاز الطالب بدون الحاجة إلى خوادم وسيطة أو مفاتيح خارجية، مما يضمن سرعة لحظية، وعملاً سلساً على الهواتف والأجهزة اللوحية وحماية كاملة لخصوصية الصوت.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center shrink-0">
                <Headphones className="w-5 h-5 text-indigo-700" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">
                  2. التقييم الهجين المزدوج (50% + 50%)
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  تُحتسب الدرجة النهائية بوزن متوازن: 50% لمطابقة النص المفرغ ومخارج الحروف مع نموذج الذكاء الاصطناعي، و 50% لمطابقة البصمة الصوتية الطيفية مع تسجيل صوت المعلم النموذجي عبر خوارزميات المعالجة الفيزيائية (MFCC + DTW).
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Sliders className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">
                  3. مستويات التدقيق والتكرار والمدة المخصصة
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  إمكانية تخصيص كل تمرين بمستوى تدقيق (سهل للمبتدئين، متوسط متوازن، متقدم صارم)، مع تحديد عدد مرات التكرار المطلوبة ورصد نبضات الطاقة الفيزيائية (Energy Pulses)، وتحديد مدة التسجيل المخصصة بالثواني.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">
                  4. الحفظ التلقائي في Google Drive و Google Sheets
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  حفظ أصوات المعلم في مجلد Google Drive، وحفظ أصوات الطلاب في المجلد المخصص لهم، مع توثيق الدروس أفقياً في ورقة "الدروس" وتسجيل درجات الطلاب في ورقة "answers 1" بصورة لحظية.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Practice Steps */}
        {activeTab === 'steps' && (
          <div className="space-y-3.5 my-3 text-xs text-slate-700 leading-relaxed animate-in fade-in duration-200">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                ١
              </span>
              <div>
                <div className="font-bold text-slate-900 text-sm mb-1">
                  قراءة الكلمة والحركات
                </div>
                <div>
                  يقرأ الطالب الكلمة أو الحرف بالتشكيل الكامل (فتحة، ضمة، كسرة، سكون، تنوين، شدة) مع الاطلاع على مخرج الحرف الصحيح (مكان اللسان والشفتين والحلق).
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                ٢
              </span>
              <div>
                <div className="font-bold text-slate-900 text-sm mb-1">
                  الاستماع للصوت النموذجي الفصيح
                </div>
                <div>
                  يضغط الطالب على زر "استمع للصوت"، مع إمكانية تشغيل الصوت ببطء (0.7x) للتدرب على المدود ومخارج الحروف الصعبة، أو تشغيل صوت المعلم المسجل.
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                ٣
              </span>
              <div>
                <div className="font-bold text-slate-900 text-sm mb-1">
                  تسجيل نطق الطالب عبر الميكروفون
                </div>
                <div>
                  يضغط الطالب على زر الميكروفون وينطق الكلمة بصوته. يظهر عداد الثواني التنازلي والموج الصوتي الحي، ويتوقف التسجيل تلقائياً عند انتهاء المدة المحددة للتمرين، ثم يُحفظ في Drive ويُقفل الزر لمنع التكرار العشوائي.
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                ٤
              </span>
              <div>
                <div className="font-bold text-emerald-950 text-sm mb-1">
                  التقييم الفوري الذكي بالذكاء الاصطناعي
                </div>
                <div>
                  يقوم النظام بتحليل الصوت والصوتيات:
                  <ul className="list-disc list-inside space-y-1 mt-1 text-slate-700">
                    <li>درجة النطق الإجمالية من 100%.</li>
                    <li>تحليل كل حرف وحركة بدقة (سليم / يحتاج تصحيح).</li>
                    <li>نصيحة عملية لكيفية تعديل مخرج الحرف (مثل التفريق بين: ض و د، ط و ت، ق و ك).</li>
                    <li>توثيق النتيجة أفقياً في ورقة Google Sheets (answers 1).</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Unified Sound & Evaluation Settings */}
        {activeTab === 'settings' && (
          <div className="space-y-4 my-3 animate-in fade-in duration-200 text-xs">
            {/* Preferred Evaluation Mode */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
              <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  <span>محرك تقييم النطق المعتمد:</span>
                </span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Whisper الداخلي موصى به
                </span>
              </label>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onUpdateSettings) onUpdateSettings({ preferredEvaluationMode: 'whisper' });
                    if (onUpdateDefaultEvalMode) onUpdateDefaultEvalMode('whisper');
                  }}
                  className={`w-full p-2.5 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                    ((settings?.preferredEvaluationMode || defaultEvalMode || 'whisper') === 'whisper')
                      ? 'bg-cyan-50 border-cyan-500 text-cyan-950 shadow-xs ring-1 ring-cyan-500/30'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span>الذكاء الداخلي (Whisper WebAssembly 🚀)</span>
                      <span className="text-[10px] bg-cyan-200 text-cyan-900 px-1.5 py-0.5 rounded-md font-bold">
                        المعتمد الأساسي 🌟
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      يعمل داخل المتصفح مباشرة، متوافق 100% مع كافة الأجهزة والجوالات بدون خوادم خارجية وبلا تكلفة
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onUpdateSettings) onUpdateSettings({ preferredEvaluationMode: 'local' });
                    if (onUpdateDefaultEvalMode) onUpdateDefaultEvalMode('local');
                  }}
                  className={`w-full p-2.5 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                    (settings?.preferredEvaluationMode || defaultEvalMode) === 'local'
                      ? 'bg-slate-100 border-slate-500 text-slate-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span>التعرف النصي للمتصفح (Web Speech API 🌐)</span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-md font-bold">
                        Chrome
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      نظام التعرف الصوتي المدمج بمتصفح Chrome للمقارنة النصية السريعة
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onUpdateSettings) onUpdateSettings({ preferredEvaluationMode: 'acoustic' });
                    if (onUpdateDefaultEvalMode) onUpdateDefaultEvalMode('acoustic');
                  }}
                  className={`w-full p-2.5 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                    (settings?.preferredEvaluationMode || defaultEvalMode) === 'acoustic'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold">التحليل الصوتي الفيزيائي المباشر (Acoustic Matching 📊)</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      مطابقة ذبذبات وترددات الصوت بالمعالجة الفيزيائية الرياضية
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Audio Generation Engine */}
            {settings && onUpdateSettings && (
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-emerald-600" />
                  <span>محرك توليد الصوت الفصيح:</span>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ engine: 'gemini' })}
                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      settings.engine === 'gemini'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold">صوت الذكاء الاصطناعي</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      فصاحة استوديو فائقة بالحركات
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ engine: 'browser' })}
                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      settings.engine === 'browser'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold">صوت المتصفح المباشر</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      استجابة فورية سريعة
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Default Speech Speed */}
            {settings && onUpdateSettings && (
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-emerald-600" />
                  <span>سرعة النطق الافتراضية:</span>
                </label>

                <div className="flex gap-2">
                  {[
                    { speed: 0.7, label: '0.7x بطيء (للمبتدئين)' },
                    { speed: 0.9, label: '0.9x متوسط' },
                    { speed: 1.1, label: '1.1x سريع' },
                  ].map((s) => (
                    <button
                      key={s.speed}
                      type="button"
                      onClick={() => onUpdateSettings({ speed: s.speed })}
                      className={`flex-1 py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        settings.speed === s.speed
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Auto Play on Word Open */}
            {settings && onUpdateSettings && (
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    تشغيل الصوت تلقائياً عند فتح الكلمة
                  </div>
                  <div className="text-[11px] text-slate-500">
                    يساعدك على الاستماع فوراً قبل الانتقال لنطقك
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoPlayTarget}
                  onChange={(e) => onUpdateSettings({ autoPlayTarget: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            )}

            {/* Optional Gemini API Key for External Deployments */}
            {settings && onUpdateSettings && (
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-indigo-600" />
                    <span>مفتاح Gemini API (اختياري للخدمات الخارجية):</span>
                  </label>
                  {settings.geminiApiKey && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      مُفعّل
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="flex-1 px-3 py-2 text-xs bg-white border border-indigo-200 rounded-xl focus:outline-hidden font-mono text-left dir-ltr"
                  />
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    {keySaved ? 'تم!' : 'حفظ'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            إغلاق ومتابعة
          </button>
        </div>
      </div>
    </div>
  );
};
