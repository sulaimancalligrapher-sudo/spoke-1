import React, { useState } from 'react';
import { ShieldCheck, Lock, User, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';

import { AdminUserRecord } from '../types';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (adminName: string) => void;
  adminUsers?: AdminUserRecord[];
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  adminUsers = [],
}) => {
  const [adminName, setAdminName] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanName = adminName.trim();
    const cleanPin = adminPin.trim();

    if (!cleanName) {
      setErrorMsg('يرجى إدخال اسم المسؤول الإداري المسجل في الشيت.');
      return;
    }
    if (!cleanPin) {
      setErrorMsg('يرجى إدخال رقم / كود الدخول الخاص بك.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);

      // 1. التحقق من قائمة الإداريين المسجلين في ورقة "الرئيسية" D2:F31
      if (adminUsers && adminUsers.length > 0) {
        // البحث عن الإداري بمطابقة الاسم ورقم الدخول PIN
        const matched = adminUsers.find((u) => {
          const nameMatches =
            u.name.toLowerCase() === cleanName.toLowerCase() ||
            u.name.replace(/\s+/g, '') === cleanName.replace(/\s+/g, '');
          const pinMatches = u.pin === cleanPin;
          return nameMatches && pinMatches;
        }) || adminUsers.find((u) => u.pin === cleanPin);

        if (matched) {
          // فحص حالة منع الدخول F2:F31 (إذا كانت القيمة "لا" يمنع فوراً)
          if (matched.blocked) {
            setErrorMsg('يوجد خطا في التسجيل .. يرجى التواصل مع الادارة');
            return;
          }

          setSuccessMsg(`تم التحقق الإداري بنجاح! مرحباً بك يا ${matched.name}.`);
          try {
            sessionStorage.setItem('faseeh_admin_auth', 'true');
            sessionStorage.setItem('faseeh_admin_name', matched.name);
          } catch {}
          setTimeout(() => {
            onLoginSuccess(matched.name);
            onClose();
          }, 500);
          return;
        }
      }

      // 2. كود الدخول الافتراضي الرئيسي من داخل الكود (الاسم: عزام / رقم الدخول: 2026115)
      const isDefaultAdmin =
        (cleanName === 'عزام' && cleanPin === '2026115') ||
        cleanPin === '2026115';
      if (isDefaultAdmin) {
        const activeName = cleanName || 'عزام';
        setSuccessMsg(`تم الدخول بنجاح! مرحباً بك يا ${activeName}.`);
        try {
          sessionStorage.setItem('faseeh_admin_auth', 'true');
          sessionStorage.setItem('faseeh_admin_name', activeName);
        } catch {}
        setTimeout(() => {
          onLoginSuccess(activeName);
          onClose();
        }, 500);
        return;
      }

      setErrorMsg('بيانات الدخول غير صحيح .. راجع الادارة');
    }, 350);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200 font-cairo">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative text-right">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute left-4 top-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          title="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-md">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              تسجيل دخول المشرف / المعلم
            </h3>
            <p className="text-xs text-slate-500">
              الوصول المحمي إلى لوحة إدارة الدروس والمناهج
            </p>
          </div>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>اسم المعلم / المشرف:</span>
            </label>
            <input
              type="text"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="أدخل اسم المشرف الإداري"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white transition-all text-right"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>رقم المعرف الإداري أو الرمز السري:</span>
            </label>
            <input
              type="password"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              placeholder="أدخل رمز الدخول السري"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white transition-all text-right"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-slate-900/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التحقق والدخول...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>دخول لوحة الإدارة 🔒</span>
                </>
              )}
            </button>
          </div>
        </form>

        <p className="text-[10px] text-slate-400 text-center mt-4">
          🔐 يتم التحقق تلقائياً من قائمة الإداريين وأكواد الدخول المسجلة في ورقة "الرئيسية" (الخلايا D2:F31).
        </p>
      </div>
    </div>
  );
};
