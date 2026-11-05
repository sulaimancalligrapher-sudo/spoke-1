import React, { useState } from 'react';
import { ShieldCheck, Lock, User, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (adminName: string) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [adminName, setAdminName] = useState(() => {
    try {
      return sessionStorage.getItem('faseeh_admin_name') || 'المعلم المشرف';
    } catch {
      return 'المعلم المشرف';
    }
  });
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
      setErrorMsg('يرجى إدخال اسم المعلم أو المشرف الإداري.');
      return;
    }
    if (!cleanPin) {
      setErrorMsg('يرجى إدخال رقم المعرف الإداري أو الرمز السري.');
      return;
    }

    setLoading(true);

    // Verify credentials (Supports default Master PIN: '1000' or 'admin' or 'admin123')
    setTimeout(() => {
      setLoading(false);
      const validPins = ['1000', 'admin', 'admin123', '2026', 'faseeh'];
      if (validPins.includes(cleanPin.toLowerCase())) {
        setSuccessMsg(`تم التحقق الإداري بنجاح! مرحباً بك يا ${cleanName}.`);
        try {
          sessionStorage.setItem('faseeh_admin_auth', 'true');
          sessionStorage.setItem('faseeh_admin_name', cleanName);
        } catch {}
        setTimeout(() => {
          onLoginSuccess(cleanName);
          onClose();
        }, 600);
      } else {
        setErrorMsg('رقم المعرف أو الرمز السري غير صحيح. المعرف الافتراضي هو 1000.');
      }
    }, 400);
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
              placeholder="مثال: المعلم أو أ. أحمد"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white transition-all text-right"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>رقم المعرف الإداري أو الرمز السري:</span>
              </span>
              <span className="text-[10px] text-emerald-700 font-mono font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                الافتراضي: 1000
              </span>
            </label>
            <input
              type="password"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              placeholder="أدخل الرمز الإداري (1000)"
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
          🔐 تقتصر هذه اللوحة على المعلم المعتمد لضبط الكلمات والتقييم ومزامنة الجداول.
        </p>
      </div>
    </div>
  );
};
