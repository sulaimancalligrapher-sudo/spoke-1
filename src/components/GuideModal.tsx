import React from 'react';
import { X, CheckCircle, Volume2, Mic, Sparkles, BookOpen, HelpCircle } from 'lucide-react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute left-5 top-5 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              نعم، يمكن تطبيق ذلك بكل سهولة وإتقان!
            </h3>
            <p className="text-xs text-emerald-700 font-semibold">
              كيف يعمل تطبيق فصيح لتعليم وتقييم النطق العربي؟
            </p>
          </div>
        </div>

        <div className="space-y-4 my-4 text-xs text-slate-700 leading-relaxed">
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
                يضغط الطالب على زر "استمع للصوت"، مع إمكانية تشغيل الصوت ببطء (0.7x) للتدرب على المدود ومخارج الحروف الصعبة لغير الناطقين بها.
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
                يضغط الطالب على زر الميكروفون الدائري وينطق الكلمة بصوته. يظهر موج صوتي حي وتفريغ نصي فوري لما قاله.
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

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            فهمت، لنبدأ التدريب الآن!
          </button>
        </div>
      </div>
    </div>
  );
};
