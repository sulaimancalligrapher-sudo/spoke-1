import React, { useState } from 'react';
import { User, KeyRound, CheckCircle2, AlertCircle, Loader2, X, ShieldCheck } from 'lucide-react';
import { StudentRegistrant } from '../types';
import { verifyStudentLogin, ensureIDRegistrantsSheet } from '../utils/googleSheets';

interface StudentLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (student: StudentRegistrant) => void;
  webhookUrl: string;
}

export const StudentLoginModal: React.FC<StudentLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  webhookUrl,
}) => {
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanName = studentName.trim();
    const cleanId = studentId.trim();

    if (!cleanName) {
      setErrorMsg('يرجى إدخال اسم المشترك');
      return;
    }
    if (!cleanId) {
      setErrorMsg('يرجى إدخال رقم ID');
      return;
    }

    setLoading(true);
    try {
      const result = await verifyStudentLogin(webhookUrl, cleanName, cleanId);

      if (result.success && result.student) {
        setSuccessMsg(`أهلاً بك يا ${result.student.name}! تم التحقق من ورقة ID registrants بنجاح.`);
        setTimeout(() => {
          onLoginSuccess(result.student!);
          onClose();
        }, 800);
      } else {
        setErrorMsg(result.error || 'عفواً، الاسم أو رقم ID غير مسجل في ورقة (ID registrants).');
      }
    } catch (err: any) {
      setErrorMsg('حدث خطأ أثناء الاتصال بالجدول: ' + (err.message || 'خطأ غير متوقع'));
    } finally {
      setLoading(false);
    }
  };

  const handleInitSheet = async () => {
    if (!webhookUrl) {
      setErrorMsg('يرجى التأكد من ربط Google Sheets في لوحة التحكم أولاً.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await ensureIDRegistrantsSheet(webhookUrl);
      if (res.success) {
        setSuccessMsg('تم إنشاء وتجهيز ورقة "ID registrants" بنجاح في Google Sheets!');
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg('خطأ أثناء تجهيز الورقة: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-cairo animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#0c3868] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <User className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                تسجيل دخول المشترك 🎓
              </h3>
              <p className="text-xs text-blue-100">
                التحقق عبر ورقة المشتركين (ID registrants)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-start gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">{successMsg}</span>
            </div>
          )}

          {/* Field 1: اسم المشترك */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <User className="w-4 h-4 text-emerald-600" />
              <span>اسم المشترك:</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="أدخل اسم المشترك كما هو مسجل (مثال: أحمد علي)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium"
                required
              />
            </div>
          </div>

          {/* Field 2: رقم ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-indigo-600" />
              <span>رقم المشترك (ID):</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="أدخل رقم ID الخاص بك (مثال: 1001)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono font-bold"
                required
              />
            </div>
          </div>

          {/* Info note */}
          <div className="p-2.5 bg-blue-50/80 border border-blue-100 rounded-xl text-[11px] text-blue-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              يتم مطابقة الاسم ورقم الـ ID تلقائياً مع ورقة <strong>ID registrants</strong> في ملف الشيت.
            </span>
          </div>

          {/* Submit Action Button */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#0c3868] hover:bg-blue-900 text-white font-bold rounded-2xl text-sm transition-all shadow-md shadow-blue-900/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التحقق من ورقة المشتركين...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>تسجيل الدخول والمتابعة</span>
                </>
              )}
            </button>

            {/* Quick helper for teacher to prepare sheet */}
            {webhookUrl && (
              <button
                type="button"
                onClick={handleInitSheet}
                disabled={loading}
                className="text-[11px] text-slate-500 hover:text-indigo-600 text-center py-1 font-semibold transition-colors cursor-pointer"
              >
                🛠️ إنشاء/تأكيد ورقة ID registrants في الشيت
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
