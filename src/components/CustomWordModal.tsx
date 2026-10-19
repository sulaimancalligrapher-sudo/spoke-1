import React, { useState } from 'react';
import { WordItem } from '../types';
import { X, Plus, Sparkles, Keyboard } from 'lucide-react';
import { removeTashkeel } from '../utils/arabicMatcher';

interface CustomWordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWord: (newWord: WordItem) => void;
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

export const CustomWordModal: React.FC<CustomWordModalProps> = ({
  isOpen,
  onClose,
  onAddWord,
}) => {
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [makhrajTip, setMakhrajTip] = useState('');

  if (!isOpen) return null;

  const handleInsertTashkeel = (char: string) => {
    setWord((prev) => prev + char);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim()) return;

    const newItem: WordItem = {
      id: `custom-${Date.now()}`,
      word: word.trim(),
      plainWord: removeTashkeel(word.trim()),
      meaning: meaning.trim() || 'كلمة مخصصة أضافها المتعلم',
      category: 'الكلمة',
      lessonSubject: 'دروس مخصصة',
      level: 2,
      makhrajTip: makhrajTip.trim() || 'انطق الكلمة بوضوح مع مراعاة الحركات المشكّلة.',
      letterFocus: word.trim()[0] || 'ك',
    };

    onAddWord(newItem);
    setWord('');
    setMeaning('');
    setMakhrajTip('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative">
        <button
          onClick={onClose}
          className="absolute left-5 top-5 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              إضافة كلمة أو جملة مخصصة
            </h3>
            <p className="text-xs text-slate-500">
              اكتب الكلمة بالتشكيل للتدرب على نطقها وتقييمها
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              الكلمة أو الجملة (مع التشكيل للحصول على أدق تقييم):
            </label>
            <input
              type="text"
              required
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="مثال: الْحَمْدُ لِلَّهِ، زَهْرَةٌ، طَيْرٌ..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-amiri text-xl text-slate-900 placeholder:text-sm placeholder:font-cairo placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
            />
          </div>

          {/* Quick Diacritics Keyboard */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 mb-2">
              <Keyboard className="w-3.5 h-3.5 text-emerald-600" />
              <span>لوحة التشكيل السريع (اضغط لإضافة الحركة):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TASHKEEL_BUTTONS.map((t) => (
                <button
                  key={t.char}
                  type="button"
                  onClick={() => handleInsertTashkeel(t.char)}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-lg font-amiri text-lg font-bold text-slate-800 transition-colors shadow-2xs"
                  title={t.name}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              المعنى أو التوضيح (اختياري):
            </label>
            <input
              type="text"
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              placeholder="مثال: شكر وثناء، اسم زهرة جميلة..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ملاحظة أو إرشاد صوتي (اختياري):
            </label>
            <input
              type="text"
              value={makhrajTip}
              onChange={(e) => setMakhrajTip(e.target.value)}
              placeholder="مثال: التركيز على تفخيم حرف الطاء..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 rounded-xl"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              إضافة والبدء بالتدرب
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
