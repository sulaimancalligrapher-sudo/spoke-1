import React, { useState } from 'react';
import { AudioSettings } from '../types';
import { X, Settings, Volume2, Sparkles, Mic, Gauge, Key, CheckCircle2, Zap } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AudioSettings;
  onUpdateSettings: (newSettings: Partial<AudioSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState(settings.geminiApiKey || '');
  const [keySaved, setKeySaved] = useState(false);

  if (!isOpen) return null;

  const handleSaveKey = () => {
    onUpdateSettings({ geminiApiKey: apiKeyInput.trim() });
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute left-5 top-5 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">إعدادات الصوت والنطق والذكاء الاصطناعي</h3>
            <p className="text-xs text-slate-500">تخصيص تجربة الاستماع والتقييم الصوتي عبر الأجهزة</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Gemini API Key */}
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-indigo-600" />
                <span>مفتاح Gemini API (لتفعيل الذكاء الاصطناعي على Vercel):</span>
              </label>
              {settings.geminiApiKey && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  مُفعّل
                </span>
              )}
            </div>
            <p className="text-[11px] text-indigo-700/80 leading-relaxed mb-2.5">
              إذا نشرت الموقع على Vercel، يمكنك لصق مفتاح Gemini هنا ليعمل تقييم الصوت بالذكاء الاصطناعي والاستماع الفصيح فوراً على جهازك وجوالك.
            </p>
            <div className="flex gap-1.5">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 px-3 py-2 text-xs bg-white border border-indigo-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-left dir-ltr"
              />
              <button
                type="button"
                onClick={handleSaveKey}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {keySaved ? 'تم الحفظ!' : 'حفظ'}
              </button>
            </div>
          </div>

          {/* Audio Engine */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>محرك توليد الصوت العربي:</span>
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

          {/* Preferred Evaluation Engine (Admin / Settings) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-emerald-600" />
                <span>محرك تقييم النطق المعتمد للطلاب (إعدادات الإدارة):</span>
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">اختياري</span>
            </label>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ preferredEvaluationMode: 'whisper' })}
                className={`w-full p-2.5 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                  (settings.preferredEvaluationMode || 'whisper') === 'whisper'
                    ? 'bg-cyan-50 border-cyan-500 text-cyan-950 shadow-xs ring-1 ring-cyan-500/30'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>الذكاء الداخلي (Whisper بدون سيرفر 🚀)</span>
                    <span className="text-[10px] bg-cyan-200 text-cyan-900 px-1.5 py-0.5 rounded-md font-bold">
                      المعتمد الأساسي 🌟
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    يعمل داخل المتصفح مباشرة، متوافق 100% مع الآيفون وأندرويد وفايرفوكس بدون خوادم وبلا رصيد
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ preferredEvaluationMode: 'local' })}
                className={`w-full p-2.5 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                  settings.preferredEvaluationMode === 'local'
                    ? 'bg-slate-100 border-slate-500 text-slate-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>التعرف النصي للمتصفح (النظام الاحتياطي 🌐)</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-md font-bold">
                      Chrome فقط
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    نظام سريع يعمل عبر محرك جوجل للمتصفح عند تعطل الأنظمة الأخرى
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ preferredEvaluationMode: 'acoustic' })}
                className={`w-full p-2.5 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                  settings.preferredEvaluationMode === 'acoustic'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="text-xs font-bold">التحليل الصوتي الفيزيائي المباشر (Acoustic Matching 📊)</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    مطابقة ذبذبات وترددات الصوت بالمعالجة المادية
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ preferredEvaluationMode: 'ai' })}
                className={`w-full p-2.5 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                  settings.preferredEvaluationMode === 'ai'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-950 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="text-xs font-bold">الذكاء السحابي (Gemini AI المتصل ✨)</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    تحليل صوتي متقدم مع التشكيل الكامل (يتطلب تفعيل مفتاح Vercel في الأعلى)
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Speed */}
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
                  className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
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

          {/* Auto play toggle */}
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
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
          >
            حفظ وإغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
