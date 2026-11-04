import {
  Mic,
  Flame,
  Award,
  Settings,
  HelpCircle,
  PlusCircle,
  Sliders,
  FileSpreadsheet,
  User,
  LogOut,
} from 'lucide-react';
import { StudentRegistrant } from '../types';

interface NavbarProps {
  streak: number;
  totalPracticed: number;
  onOpenStats: () => void;
  onOpenSettings: () => void;
  onOpenGuide: () => void;
  onOpenCustom: () => void;
  onOpenAdmin: () => void;
  isSheetsActive?: boolean;
  onOpenLessons?: () => void;
  onGoHome?: () => void;
  currentView?: 'landing' | 'practice';
  currentStudent?: StudentRegistrant | null;
  onOpenLogin?: () => void;
  onLogout?: () => void;
  customLogoUrl?: string;
  customTitle?: string;
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
  onOpenLessons,
  onGoHome,
  currentView = 'landing',
  currentStudent,
  onOpenLogin,
  onLogout,
  customLogoUrl,
  customTitle,
}) => {
  return (
    <header className="bg-white/90 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 shadow-2xs">
      <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-2 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        {/* ROW 1 ON MOBILE (الشعار والعنوان + اسم الطالب وزر الخروج): Full width row on mobile, left side on desktop */}
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div
            onClick={onGoHome}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group"
            title="العودة للصفحة الرئيسية التعريفية"
          >
            {customLogoUrl ? (
              <img
                src={customLogoUrl}
                alt="شعار المنصة"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl object-cover shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform border border-slate-200"
                onError={(e) => {
                  (e.target as any).style.display = 'none';
                  const fb = (e.target as any).nextElementSibling;
                  if (fb) fb.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-linear-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-amiri text-xl sm:text-2xl font-bold shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform ${
                customLogoUrl ? 'hidden' : 'flex'
              }`}
            >
              ف
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight font-cairo">
                  {customTitle || 'فَصِيح'}
                </h1>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-[10px] font-bold">
                  تقييم النطق الذكي
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 hidden sm:block">
                تعليم النطق والاستماع وتقييم مخارج الحروف العربية
              </p>
            </div>
          </div>

          {/* Student Status on Mobile (اسم الطالب وزر خروج أيقونة فقط) */}
          <div className="sm:hidden flex items-center gap-1.5">
            {currentStudent ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-xl text-xs font-bold shadow-2xs">
                <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate max-w-[85px]">{currentStudent.name}</span>
                <button
                  onClick={onLogout}
                  className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                title="تسجيل دخول الطالب"
              >
                <User className="w-3.5 h-3.5" />
                <span>دخول الطالب</span>
              </button>
            )}
          </div>
        </div>

        {/* ROW 2 ON MOBILE (باقي الأزرار): Dedicated row on mobile, right side on desktop */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-3 w-full sm:w-auto pt-1 sm:pt-0 border-t border-slate-100 sm:border-t-0">
          {/* Quick Open Lessons Button */}
          {onOpenLessons && (
            <button
              onClick={onOpenLessons}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-600/20 cursor-pointer"
              title="فتح قائمة الدروس واختيار تمرين"
            >
              <span>فتح الدروس 📚</span>
            </button>
          )}

          {/* Student Status on Desktop (اسم المشترك وزر خروج أيقونة فقط) */}
          <div className="hidden sm:flex items-center gap-1.5">
            {currentStudent ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-xl text-xs font-bold shadow-2xs">
                <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-extrabold">{currentStudent.name}</span>
                <span className="text-[10px] text-emerald-700 font-mono bg-emerald-100/80 px-1.5 py-0.5 rounded-md">ID: {currentStudent.id}</span>
                <button
                  onClick={onLogout}
                  className="p-1 hover:bg-emerald-200/80 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                title="تسجيل دخول الطالب"
              >
                <User className="w-3.5 h-3.5" />
                <span>دخول المشترك</span>
              </button>
            )}
          </div>

          {/* Admin Panel Direct Link */}
          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="الانتقال إلى لوحة إدارة المعلم والدروس"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] sm:text-xs">لوحة الإدارة</span>
            {isSheetsActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          {/* Desktop Streak indicator */}
          {streak > 0 && (
            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs font-bold shadow-2xs"
              title={`سلسلة إنجاز متواصلة: ${streak} كلمات`}
            >
              <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>{streak}</span>
            </div>
          )}

          {/* Guide question button */}
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            title="دليل وكيف يعمل النظام؟"
          >
            <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[11px] sm:text-xs">الدليل</span>
          </button>

          {/* Stats Button: ONLY DISPLAYED IF STUDENT IS LOGGED IN */}
          {currentStudent && (
            <button
              onClick={onOpenStats}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer relative shadow-2xs group"
              title="سجل التقييمات والإنجاز للطالب"
            >
              <Award className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="hidden sm:inline">سجل التقييمات والإنجاز</span>
              {totalPracticed > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-600 text-white text-[10px] font-bold rounded-full">
                  {totalPracticed}
                </span>
              )}
            </button>
          )}

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 sm:p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
            title="إعدادات الصوت"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
