import React, { useState } from 'react';
import { MatchingLessonSubject, MatchingExercise, MatchingPair } from '../types';
import {
  saveMatchingExerciseToSheets,
  fetchMatchingExercisesFromSheets,
  STORAGE_KEY_MATCHING_CURRICULUM,
} from '../utils/googleSheets';
import {
  Plus,
  Trash2,
  Save,
  RefreshCw,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  Sparkles,
  ArrowRight,
  List,
} from 'lucide-react';

interface MatchingAdminManagerProps {
  subjects: MatchingLessonSubject[];
  onUpdateSubjects: (subjects: MatchingLessonSubject[]) => void;
  webhookUrl?: string;
}

export const MatchingAdminManager: React.FC<MatchingAdminManagerProps> = ({
  subjects,
  onUpdateSubjects,
  webhookUrl,
}) => {
  const [subTab, setSubTab] = useState<'add' | 'list'>('list');

  // Add Exercise Form State
  const [selectedSubjectMode, setSelectedSubjectMode] = useState<'existing' | 'new'>('existing');
  const [existingSubjectName, setExistingSubjectName] = useState<string>(
    subjects[0]?.subjectName || ''
  );
  const [newSubjectName, setNewSubjectName] = useState<string>('');
  const [questionText, setQuestionText] = useState<string>('');
  const [pairs, setPairs] = useState<{ right: string; left: string }[]>([
    { right: '', left: '' },
    { right: '', left: '' },
    { right: '', left: '' },
  ]);

  const [statusMessage, setStatusMessage] = useState<{
    success: boolean;
    text: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add pair row
  const handleAddPairRow = () => {
    setPairs((prev) => [...prev, { right: '', left: '' }]);
  };

  // Remove pair row
  const handleRemovePairRow = (index: number) => {
    if (pairs.length <= 1) return;
    setPairs((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Update text in pair
  const handlePairChange = (index: number, side: 'right' | 'left', val: string) => {
    setPairs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [side]: val };
      return next;
    });
  };

  // Submit / Save Exercise
  const handleSaveExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveSubject =
      selectedSubjectMode === 'new'
        ? newSubjectName.trim()
        : existingSubjectName.trim() || subjects[0]?.subjectName || 'تمارين وصل عامة';

    if (!effectiveSubject) {
      alert('يرجى كتابة أو اختيار موضوع الدرس');
      return;
    }

    if (!questionText.trim()) {
      alert('يرجى إدخال نص السؤال (مثال: صِلْ بَيْنَ الكَلِمَةِ وَضِدِّهَا)');
      return;
    }

    // Filter valid pairs
    const validPairs = pairs.filter((p) => p.right.trim() && p.left.trim());
    if (validPairs.length < 2) {
      alert('يرجى إدخال زوجين من الكلمات على الأقل لإكمال تمرين التوصيل');
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    // Prepare new exercise object
    const subjectItem = subjects.find((s) => s.subjectName === effectiveSubject);
    const exerciseNumber = subjectItem ? subjectItem.exercises.length + 1 : 1;

    const formattedPairs: MatchingPair[] = validPairs.map((p, idx) => ({
      id: `p-${Date.now()}-${idx + 1}`,
      rightText: p.right.trim(),
      leftText: p.left.trim(),
    }));

    const newExercise: MatchingExercise = {
      id: `match-ex-${Date.now()}`,
      exerciseNumber,
      questionText: questionText.trim(),
      pairs: formattedPairs,
    };

    // Update local state and localStorage
    let nextSubjects: MatchingLessonSubject[];
    if (subjectItem) {
      nextSubjects = subjects.map((s) => {
        if (s.id === subjectItem.id) {
          return {
            ...s,
            exercises: [...s.exercises, newExercise],
          };
        }
        return s;
      });
    } else {
      const newSubj: MatchingLessonSubject = {
        id: `match-subj-${Date.now()}`,
        subjectName: effectiveSubject,
        exercises: [newExercise],
      };
      nextSubjects = [...subjects, newSubj];
    }

    onUpdateSubjects(nextSubjects);
    try {
      localStorage.setItem(STORAGE_KEY_MATCHING_CURRICULUM, JSON.stringify(nextSubjects));
    } catch {}

    // Save to Google Sheets sheet "وصل" if webhook is active
    let sheetNote = '';
    if (webhookUrl) {
      try {
        const res = await saveMatchingExerciseToSheets(webhookUrl, {
          subjectName: effectiveSubject,
          exerciseNumber,
          questionText: questionText.trim(),
          pairs: formattedPairs,
        });
        if (res.success) {
          sheetNote = ' وتمت المزامنة بنجاح مع ورقة "وصل" في الشيت!';
        }
      } catch (err: any) {
        console.warn('Failed to sync matching exercise to sheet:', err);
      }
    }

    setIsSaving(false);
    setStatusMessage({
      success: true,
      text: `تم حفظ التمرين بنجاح في المنصة${sheetNote}`,
    });

    // Reset Form
    setQuestionText('');
    setPairs([
      { right: '', left: '' },
      { right: '', left: '' },
      { right: '', left: '' },
    ]);
    if (selectedSubjectMode === 'new') {
      setExistingSubjectName(effectiveSubject);
      setSelectedSubjectMode('existing');
      setNewSubjectName('');
    }
    setSubTab('list');
  };

  // Delete an exercise
  const handleDeleteExercise = (subjId: string, exId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا التمرين؟')) return;
    const nextSubjects = subjects
      .map((s) => {
        if (s.id === subjId) {
          const filtered = s.exercises.filter((ex) => ex.id !== exId);
          return { ...s, exercises: filtered };
        }
        return s;
      })
      .filter((s) => s.exercises.length > 0);

    onUpdateSubjects(nextSubjects);
    try {
      localStorage.setItem(STORAGE_KEY_MATCHING_CURRICULUM, JSON.stringify(nextSubjects));
    } catch {}
  };

  // Refresh from sheet "وصل"
  const handleRefreshFromSheet = async () => {
    if (!webhookUrl) {
      alert('يرجى التأكد من ربط Google Sheets أولاً في تبويب الإعدادات.');
      return;
    }
    setIsRefreshing(true);
    try {
      const res = await fetchMatchingExercisesFromSheets(webhookUrl);
      if (res.success && res.subjects.length > 0) {
        onUpdateSubjects(res.subjects);
        setStatusMessage({
          success: true,
          text: `تم جلب ${res.subjects.length} مواضيع تمارين بنجاح من ورقة "وصل"!`,
        });
      } else {
        setStatusMessage({
          success: false,
          text: 'لم يتم العثور على تمارين في ورقة "وصل". تأكد من تسمية الورقة (وصل).',
        });
      }
    } catch {
      setStatusMessage({
        success: false,
        text: 'حدث خطأ أثناء محاولة جلب التمارين من الشيت.',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 w-full animate-in fade-in duration-200">
      {/* Top Banner & Sub-tabs */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              🔗
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              إدارة تمارين الوصل (وصل الكلمات)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            إضافة وتعديل أسئلة وأزواج الكلمات المترابطة المحفوظة في ورقة <strong>وصل</strong>
          </p>
        </div>

        {/* Sub-tab buttons & Refresh */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setSubTab('list')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === 'list'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>قائمة التمارين ({subjects.reduce((a, b) => a + b.exercises.length, 0)})</span>
          </button>

          <button
            onClick={() => setSubTab('add')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === 'add'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ إضافة تمرين جديد</span>
          </button>

          {webhookUrl && (
            <button
              onClick={handleRefreshFromSheet}
              disabled={isRefreshing}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer"
              title="تحديث البيانات من ورقة وصل في الشيت"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in ${
            statusMessage.success
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* SUB-TAB 1: ADD NEW EXERCISE FORM */}
      {subTab === 'add' && (
        <form
          onSubmit={handleSaveExercise}
          className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-sm flex flex-col gap-5"
        >
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800">إضافة تمرين وصل جديد</h3>
            <p className="text-xs text-slate-500">
              قم بكتابة موضوع الدرس، نص السؤال، وأزواج الكلمات العربية المتطابقة.
            </p>
          </div>

          {/* Subject Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              موضوع الدرس:
            </label>
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setSelectedSubjectMode('existing')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                  selectedSubjectMode === 'existing'
                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                اختيار موضوع موجود
              </button>
              <button
                type="button"
                onClick={() => setSelectedSubjectMode('new')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                  selectedSubjectMode === 'new'
                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                + كتابة موضوع جديد
              </button>
            </div>

            {selectedSubjectMode === 'existing' ? (
              <select
                value={existingSubjectName}
                onChange={(e) => setExistingSubjectName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-hidden focus:border-purple-500"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.subjectName}>
                    {s.subjectName}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="مثال: أسماء الإشارة / الأضداد / حروف الجر..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-hidden focus:border-purple-500 placeholder:text-slate-400"
                required
              />
            )}
          </div>

          {/* Question Text */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              نص السؤال:
            </label>
            <input
              type="text"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="مثال: صِلْ بَيْنَ الكَلِمَةِ وَضِدِّهَا فِي المَعْنَى"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-hidden focus:border-purple-500 placeholder:text-slate-400"
              required
            />
          </div>

          {/* Word Pairs Builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700">
                أزواج الكلمات المتطابقة (اليمين واليسار):
              </label>
              <span className="text-[11px] text-slate-400">
                (ادخل الكلمات مرتبة؛ وسيقوم النظام بلخبطة عرضها عشوائياً للطلاب)
              </span>
            </div>

            <div className="space-y-2.5">
              {pairs.map((pair, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl flex items-center gap-2.5"
                >
                  <span className="text-xs font-bold text-slate-400 w-5 text-center">
                    {idx + 1}
                  </span>

                  {/* Right Word */}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={pair.right}
                      onChange={(e) => handlePairChange(idx, 'right', e.target.value)}
                      placeholder="الكلمة في اليمين (مثال: كَبِير)"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-amiri font-bold text-slate-800 focus:outline-hidden focus:border-purple-500 text-right"
                      required
                    />
                  </div>

                  {/* Connector icon */}
                  <div className="text-slate-300 font-bold shrink-0">⟷</div>

                  {/* Left Word */}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={pair.left}
                      onChange={(e) => handlePairChange(idx, 'left', e.target.value)}
                      placeholder="الكلمة المقابلة في اليسار (مثال: صَغِير)"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-amiri font-bold text-slate-800 focus:outline-hidden focus:border-purple-500 text-right"
                      required
                    />
                  </div>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => handleRemovePairRow(idx)}
                    disabled={pairs.length <= 1}
                    className="p-2 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-lg cursor-pointer transition-colors shrink-0"
                    title="حذف هذا الزوج"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddPairRow}
              className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-slate-200"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ إضافة زوج كلمة آخر</span>
            </button>
          </div>

          {/* Submit Button */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md shadow-purple-600/20 cursor-pointer transition-all active:scale-98"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري الحفظ في الشيت...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>حفظ التمرين إلى ورقة (وصل)</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* SUB-TAB 2: LIST EXERCISES */}
      {subTab === 'list' && (
        <div className="space-y-4">
          {subjects.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center">
              <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-xs text-slate-500 mb-3">لا توجد تمارين مسجلة حالياً</p>
              <button
                onClick={() => setSubTab('add')}
                className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                + إضافة أول تمرين الآن
              </button>
            </div>
          ) : (
            subjects.map((subj) => (
              <div
                key={subj.id}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-purple-600" />
                    <h3 className="text-sm font-bold text-slate-900">{subj.subjectName}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      {subj.exercises.length} تمارين
                    </span>
                  </div>
                </div>

                {/* Exercises list in this subject */}
                <div className="space-y-2.5">
                  {subj.exercises.map((ex) => (
                    <div
                      key={ex.id}
                      className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 text-[10px] font-bold">
                            تمرين {ex.exerciseNumber}
                          </span>
                          <span className="font-amiri text-base font-bold text-slate-800 truncate">
                            {ex.questionText}
                          </span>
                        </div>

                        {/* Words summary preview */}
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {ex.pairs.map((p) => (
                            <span
                              key={p.id}
                              className="px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-[11px] font-amiri text-slate-700"
                            >
                              {p.rightText} ⟷ {p.leftText}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleDeleteExercise(subj.id, ex.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="حذف هذا التمرين"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
