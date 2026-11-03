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
} from 'lucide-react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'methodology' | 'steps'>('methodology');

  if (!isOpen) return null;

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
              التعريف الشامل بالتقنيات ومنهجية التقييم وخطوات تدريب الطالب
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl mb-4">
          <button
            onClick={() => setActiveTab('methodology')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'methodology'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ⚙️ كيف يعمل التقييم الذكي (الأركان الـ 4)
          </button>
          <button
            onClick={() => setActiveTab('steps')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'steps'
                ? 'bg-white text-emerald-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🎯 خطوات تدريب الطالب (١ - ٤)
          </button>
        </div>

        {activeTab === 'methodology' ? (
          <div className="space-y-3.5 my-3">
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
                  حفظ أصوات المعلم المسجلة مباشرة في مجلد Google Drive المخصص، وتوثيق الدروس أفقياً في ورقة "الدروس" وتسجيل درجات الطلاب في ورقة "سجل_النتائج" بصورة لحظية.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5 my-3 text-xs text-slate-700 leading-relaxed">
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
                  يضغط الطالب على زر "استمع للصوت"، مع إمكانية تشغيل الصوت ببطء (0.7x) للتدرب على المدود ومخارج الحروف الصعبة.
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
                  يضغط الطالب على زر الميكروفون وينطق الكلمة بصوته. يظهر عداد الثواني التنازلي والموج الصوتي الحي، ويتوقف التسجيل تلقائياً عند انتهاء المدة المحددة للتمرين.
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
                    <li>إمكانية الاستماع لصوت الطالب المسجل جنباً إلى جنب مع صوت المعلم للمقارنة الذاتية.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            إغلاق ومتابعة التدريب
          </button>
        </div>
      </div>
    </div>
  );
};
