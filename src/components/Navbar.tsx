import React from 'react';
import {
  Mic,
  Flame,
  Award,
  Settings,
  HelpCircle,
  PlusCircle,
  Sliders,
  FileSpreadsheet,
} from 'lucide-react';

interface NavbarProps {
  streak: number;
  totalPracticed: number;
  onOpenStats: () => void;
  onOpenSettings: () => void;
  onOpenGuide: () => void;
  onOpenCustom: () => void;
  onOpenAdmin: () => void;
  isSheetsActive?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  streak,
  totalPracticed,
  onOpenStats,
  onOpenSettings,
  onOpenGuide,
  onOpenCustom,
  onOpenAdmin,
  isSheetsActive,
}) => {
  return (
    <header className="bg-white/85 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 shadow-2xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-amiri text-2xl font-bold shadow-md shadow-emerald-500/20">
            ف
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight font-cairo">
                فَصِيح
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-[10px] font-bold">
                تقييم النطق الذكي
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              تعليم النطق والاستماع وتقييم مخارج الحروف العربية
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Admin Panel Direct Link */}
          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="الانتقال إلى لوحة إدارة المعلم والدروس"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">لوحة الإدارة</span>
            {isSheetsActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          {/* Streak indicator */}
          {streak > 0 && (
            <div
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs font-bold shadow-2xs"
              title={`سلسلة إنجاز متواصلة: ${streak} كلمات`}
            >
              <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>{streak}</span>
            </div>
          )}

          {/* Guide question button */}
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            title="كيف يعمل النظام؟"
          >
            <HelpCircle className="w-4 h-4 text-emerald-600" />
            <span className="hidden md:inline">كيف يعمل؟</span>
          </button>

          {/* Stats Button */}
          <button
            onClick={onOpenStats}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all cursor-pointer relative"
            title="سجل التقييمات والإنجاز"
          >
            <Award className="w-5 h-5" />
            {totalPracticed > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {totalPracticed > 9 ? '+9' : totalPracticed}
              </span>
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
            title="إعدادات الصوت"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
