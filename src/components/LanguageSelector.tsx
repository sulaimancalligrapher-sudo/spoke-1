import React, { useState, useRef, useEffect } from 'react';
import { SupportedLang, LANGUAGE_OPTIONS } from '../utils/translations';
import { Globe, ChevronDown, Check } from 'lucide-react';

interface LanguageSelectorProps {
  currentLang: SupportedLang;
  onSelectLang: (lang: SupportedLang) => void;
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLang,
  onSelectLang,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOption =
    LANGUAGE_OPTIONS.find((opt) => opt.code === currentLang) || LANGUAGE_OPTIONS[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block text-right ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer select-none active:scale-95"
        title="تغيير لغة الواجهة (العربية / ภาษาไทย / English)"
      >
        <span className="text-sm leading-none">{currentOption.flag}</span>
        <span className="hidden sm:inline text-xs font-bold">{currentOption.nativeName}</span>
        <span className="sm:hidden text-[10px] font-mono font-extrabold text-slate-700 uppercase">
          {currentOption.code}
        </span>
        <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 sm:right-0 sm:left-auto mt-1.5 w-40 max-w-[calc(100vw-20px)] bg-white rounded-2xl shadow-2xl border border-slate-200 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {LANGUAGE_OPTIONS.map((opt) => {
            const isSelected = opt.code === currentLang;
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => {
                  onSelectLang(opt.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors cursor-pointer text-right ${
                  isSelected
                    ? 'bg-emerald-50 text-emerald-950 font-extrabold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{opt.flag}</span>
                  <div className="flex flex-col text-right">
                    <span className="text-xs">{opt.nativeName}</span>
                    <span className="text-[9px] text-slate-400 font-normal">{opt.name}</span>
                  </div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
