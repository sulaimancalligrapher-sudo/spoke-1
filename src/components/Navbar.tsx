import React, { useEffect, useRef, useState } from 'react';
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
  BookOpen,
  ChevronDown,
  Link2,
  PenTool,
} from 'lucide-react';
import { StudentRegistrant } from '../types';
import { LanguageSelector } from './LanguageSelector';
import { SupportedLang } from '../utils/translations';

interface NavbarProps {
  streak: number;
  totalPracticed: number;
  onOpenStats: () => void;
  onOpenSettings?: () => void;
  onOpenGuide?: () => void;
  onOpenCustom?: () => void;
  onOpenAdmin: () => void;
  isAdminAuthenticated?: boolean;
  onAdminLogout?: () => void;
  isSheetsActive?: boolean;
  onOpenLessons?: () => void;
  onGoHome?: () => void;
  currentView?: 'landing' | 'practice';
  currentStudent?: StudentRegistrant | null;
  onOpenLogin?: () => void;
  onLogout?: () => void;
  customLogoUrl?: string;
  customTitle?: string;
  currentLang?: SupportedLang;
  onSelectLang?: (lang: SupportedLang) => void;
  t?: (id: string, fallback?: string) => string;
  onOpenMatchingLessons?: () => void;
  onOpenDictationLessons?: () => void;
  currentMode?: 'pronunciation' | 'matching' | 'dictation';
  onSelectMode?: (mode: 'pronunciation' | 'matching' | 'dictation') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  streak,
  onOpenStats,
  onOpenSettings,
  onOpenGuide,
  onOpenCustom,
  onOpenAdmin,
  isAdminAuthenticated,
  onAdminLogout,
  isSheetsActive,
  onOpenLessons,
  onGoHome,
  currentView = 'landing',
  currentStudent,
  onOpenLogin,
  onLogout,
  customLogoUrl,
  customTitle,
  currentLang = 'ar',
  onSelectLang,
  t,
  onOpenMatchingLessons,
  onOpenDictationLessons,
  currentMode = 'pronunciation',
  onSelectMode,
}) => {
  const tr = (id: string, fallback: string) => (t ? t(id, fallback) : fallback);
  const [lessonsMenuOpen, setLessonsMenuOpen] = useState(false);
  const lessonsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (lessonsMenuRef.current && !lessonsMenuRef.current.contains(e.target as Node)) {
        setLessonsMenuOpen(false);
      }
    };
    if (lessonsMenuOpen) {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('touchstart', handleOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [lessonsMenuOpen]);

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
                {Boolean(customTitle !== undefined && customTitle !== null ? customTitle : tr('nav_platform_title', 'فَصِيح')) && (
                  <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight font-cairo">
                    {customTitle !== undefined && customTitle !== null ? customTitle : tr('nav_platform_title', 'فَصِيح')}
                  </h1>
                )}
                {Boolean(tr('nav_smart_eval_badge', 'تقييم النطق الذكي')) && (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-[10px] font-bold">
                    {tr('nav_smart_eval_badge', 'تقييم النطق الذكي')}
                  </span>
                )}
              </div>
              {Boolean(tr('nav_platform_subtitle', 'تعليم النطق والاستماع وتقييم مخارج الحروف العربية')) && (
                <p className="text-[10px] sm:text-[11px] text-slate-500 hidden sm:block">
                  {tr('nav_platform_subtitle', 'تعليم النطق والاستماع وتقييم مخارج الحروف العربية')}
                </p>
              )}
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
                  title={tr('nav_logout', 'تسجيل الخروج')}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                title={tr('nav_student_login', 'دخول الطالب')}
              >
                <User className="w-3.5 h-3.5" />
                <span>{tr('nav_student_login', 'دخول الطالب')}</span>
              </button>
            )}
          </div>
        </div>

        {/* ROW 2 ON MOBILE (باقي الأزرار): Dedicated row on mobile, right side on desktop */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2.5 w-full sm:w-auto pt-1 sm:pt-0 border-t border-slate-100 sm:border-t-0">
          {/* Unified Language Selector (Arabic, Thai, English) */}
          {onSelectLang && (
            <LanguageSelector currentLang={currentLang} onSelectLang={onSelectLang} />
          )}

          {/* Unified Lessons Dropdown Button (دروس) */}
          {(onOpenLessons || onOpenMatchingLessons || onOpenDictationLessons) && (
            <div ref={lessonsMenuRef} className="relative flex-1 sm:flex-none">
              <button
                type="button"
                onClick={() => setLessonsMenuOpen((prev) => !prev)}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-600/20 cursor-pointer"
                aria-expanded={lessonsMenuOpen}
                aria-haspopup="menu"
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span>{tr('nav_lessons_menu', 'دروس')}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    lessonsMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {lessonsMenuOpen && (
                <div
                  role="menu"
                  className="absolute left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  {onOpenLessons && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setLessonsMenuOpen(false);
                        onOpenLessons();
                      }}
                      className={`w-full px-3.5 py-2.5 text-right flex items-center gap-2.5 text-xs font-bold transition-colors cursor-pointer ${
                        currentView === 'practice' && currentMode === 'pronunciation'
                          ? 'bg-indigo-50 text-indigo-800'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                        <Mic className="w-3.5 h-3.5" />
                      </span>
                      <span className="flex-1">{tr('nav_pronunciation_training', 'تدريب النطق')}</span>
                    </button>
                  )}

                  {onOpenMatchingLessons && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setLessonsMenuOpen(false);
                        onOpenMatchingLessons();
                      }}
                      className={`w-full px-3.5 py-2.5 text-right flex items-center gap-2.5 text-xs font-bold transition-colors cursor-pointer ${
                        currentView === 'practice' && currentMode === 'matching'
                          ? 'bg-purple-50 text-purple-800'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                        <Link2 className="w-3.5 h-3.5" />
                      </span>
                      <span className="flex-1">{tr('nav_matching_exercises', 'تمارين الوصل')}</span>
                    </button>
                  )}

                  {onOpenDictationLessons && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setLessonsMenuOpen(false);
                        onOpenDictationLessons();
                      }}
                      className={`w-full px-3.5 py-2.5 text-right flex items-center gap-2.5 text-xs font-bold transition-colors cursor-pointer ${
                        currentView === 'practice' && currentMode === 'dictation'
                          ? 'bg-teal-50 text-teal-800'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-7 h-7 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                        <PenTool className="w-3.5 h-3.5" />
                      </span>
                      <span className="flex-1">{tr('nav_dictation_exercise', 'تمرين الإملاء')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
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
                  title={tr('nav_logout', 'تسجيل الخروج')}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                title={tr('nav_student_login', 'دخول المشترك')}
              >
                <User className="w-3.5 h-3.5" />
                <span>{tr('nav_student_login', 'دخول المشترك')}</span>
              </button>
            )}
          </div>

          {/* Stats Button: Icon-only (without text or counter) */}
          {currentStudent && (
            <button
              onClick={onOpenStats}
              className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl transition-all cursor-pointer relative shadow-2xs group flex items-center justify-center"
              title={tr('nav_eval_history', 'سجل التقييمات والإنجاز')}
              aria-label={tr('nav_eval_history', 'سجل التقييمات والإنجاز')}
            >
              <Award className="w-4 h-4 text-amber-600 shrink-0" />
            </button>
          )}

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

          {/* Admin Panel Link: ONLY SHOWN IF ADMIN IS AUTHENTICATED */}
          {isAdminAuthenticated && (
            <div className="flex items-center gap-1.5">
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
              {onAdminLogout && (
                <button
                  onClick={onAdminLogout}
                  className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition-colors cursor-pointer border border-slate-200"
                  title="تسجيل خروج الإدارة"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
