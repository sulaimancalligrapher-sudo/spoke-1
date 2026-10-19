import React from 'react';
import { AudioSettings } from '../types';
import { X, Settings, Volume2, Sparkles, Mic, Gauge } from 'lucide-react';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative">
        <button
          onClick={onClose}
          className="absolute left-5 top-5 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">إعدادات الصوت والنطق</h3>
            <p className="text-xs text-slate-500">تخصيص تجربة الاستماع والتقييم الصوتي</p>
          </div>
        </div>

        <div className="space-y-4">
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
