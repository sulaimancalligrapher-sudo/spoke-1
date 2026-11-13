import React, { useState } from 'react';
import { MatchingLessonSubject, MatchingExercise, MatchingPair } from '../types';
import {
  saveMatchingExerciseToSheets,
  fetchMatchingExercisesFromSheets,
  exportAllMatchingCurriculumToSheets,
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
  Sparkles,
  List,
  Edit3,
  UploadCloud,
  X,
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

  // Add / Edit Exercise Form State
  const [editingInfo, setEditingInfo] = useState<{
    subjectId: string;
    exerciseId: string;
    exerciseNumber: number;
  } | null>(null);

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

  // Answer Behavior Controls:
  const [inputMode, setInputMode] = useState<'both' | 'voice_only'>('both');
  const [durationSeconds, setDurationSeconds] = useState<number>(4);
  const [lockOnMistake, setLockOnMistake] = useState<boolean>(false);
  const [showMistakeFeedback, setShowMistakeFeedback] = useState<boolean>(true);

  const [statusMessage, setStatusMessage] = useState<{
    success: boolean;
    text: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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

  // Start Editing an existing exercise
  const handleStartEdit = (subj: MatchingLessonSubject, ex: MatchingExercise) => {
    setSelectedSubjectMode('existing');
    setExistingSubjectName(subj.subjectName);
    setQuestionText(ex.questionText);
    setPairs(
      ex.pairs.length > 0
        ? ex.pairs.map((p) => ({ right: p.rightText, left: p.leftText }))
        : [
            { right: '', left: '' },
            { right: '', left: '' },
          ]
    );
    setInputMode(ex.inputMode || 'both');
    setDurationSeconds(typeof ex.durationSeconds === 'number' && ex.durationSeconds > 0 ? ex.durationSeconds : 4);
    setLockOnMistake(!!ex.lockOnMistake);
    setShowMistakeFeedback(ex.showMistakeFeedback !== false);
    setEditingInfo({
      subjectId: subj.id,
      exerciseId: ex.id,
      exerciseNumber: ex.exerciseNumber,
    });
    setSubTab('add');
    setStatusMessage({
      success: true,
      text: `أنت تقوم الآن بتعديل تمرين ${ex.exerciseNumber} في موضوع «${subj.subjectName}».`,
    });
  };

  // Cancel Editing
  const handleCancelEdit = () => {
    setEditingInfo(null);
    setQuestionText('');
    setPairs([
      { right: '', left: '' },
      { right: '', left: '' },
      { right: '', left: '' },
    ]);
    setInputMode('both');
    setDurationSeconds(4);
    setLockOnMistake(false);
    setShowMistakeFeedback(true);
    setStatusMessage(null);
    setSubTab('list');
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

    const formattedPairs: MatchingPair[] = validPairs.map((p, idx) => ({
      id: `p-${Date.now()}-${idx + 1}`,
      rightText: p.right.trim(),
      leftText: p.left.trim(),
    }));

    let nextSubjects: MatchingLessonSubject[];
    let exerciseNumberToSave = 1;

    if (editingInfo) {
      // EDIT MODE
      exerciseNumberToSave = editingInfo.exerciseNumber;
      nextSubjects = subjects.map((s) => {
        if (s.id === editingInfo.subjectId) {
          return {
            ...s,
            exercises: s.exercises.map((ex) => {
              if (ex.id === editingInfo.exerciseId) {
                return {
                  ...ex,
                  questionText: questionText.trim(),
                  pairs: formattedPairs,
                  inputMode,
                  durationSeconds,
                  lockOnMistake,
                  showMistakeFeedback,
                };
              }
              return ex;
            }),
          };
        }
        return s;
      });
    } else {
      // ADD MODE
      const subjectItem = subjects.find((s) => s.subjectName === effectiveSubject);
      exerciseNumberToSave = subjectItem ? subjectItem.exercises.length + 1 : 1;

      const newExercise: MatchingExercise = {
        id: `match-ex-${Date.now()}`,
        exerciseNumber: exerciseNumberToSave,
        questionText: questionText.trim(),
        pairs: formattedPairs,
        inputMode,
        durationSeconds,
        lockOnMistake,
        showMistakeFeedback,
      };

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
    }

    // Update state and localStorage
    onUpdateSubjects(nextSubjects);
    try {
      localStorage.setItem(STORAGE_KEY_MATCHING_CURRICULUM, JSON.stringify(nextSubjects));
    } catch {}

    // Save to Google Sheet "وصل"
    if (webhookUrl) {
      try {
        const sheetRes = await saveMatchingExerciseToSheets(webhookUrl, {
          subjectName: effectiveSubject,
          exerciseNumber: exerciseNumberToSave,
          questionText: questionText.trim(),
          pairs: formattedPairs,
          inputMode,
          durationSeconds,
          lockOnMistake,
          showMistakeFeedback,
        });

        if (sheetRes.success) {
          setStatusMessage({
            success: true,
            text: editingInfo
              ? `تم تحديث وحفظ التمرين ${exerciseNumberToSave} بنجاح في ورقة "وصل"!`
              : `تم حفظ التمرين الجديد بنجاح في ورقة "وصل"!`,
          });
        } else {
          setStatusMessage({
            success: false,
            text: `تم الحفظ محلياً، وتعذر التحديث في الشيت: ${sheetRes.error || ''}`,
          });
        }
      } catch {
        setStatusMessage({
          success: false,
          text: 'تم الحفظ محلياً في المتصفح فقط.',
        });
      }
    } else {
      setStatusMessage({
        success: true,
        text: 'تم الحفظ محلياً في المتصفح بنجاح! (للحفظ في Google Sheets تأكد من إدخال رابط Webhook)',
      });
    }

    setIsSaving(false);
    setEditingInfo(null);
    setQuestionText('');
    setPairs([
      { right: '', left: '' },
      { right: '', left: '' },
      { right: '', left: '' },
    ]);
    if (selectedSubjectMode === 'new') {
      setSelectedSubjectMode('existing');
      setExistingSubjectName(effectiveSubject);
    }
  };

  // Delete exercise
  const handleDeleteExercise = (subjectId: string, exerciseId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا التمرين؟')) return;

    const nextSubjects = subjects
      .map((subj) => {
        if (subj.id === subjectId) {
          const filtered = subj.exercises.filter((e) => e.id !== exerciseId);
          // Renumber exercises
          const renumbered = filtered.map((e, idx) => ({
            ...e,
            exerciseNumber: idx + 1,
          }));
          return { ...subj, exercises: renumbered };
        }
        return subj;
      })
      .filter((subj) => subj.exercises.length > 0);

    onUpdateSubjects(nextSubjects);
    try {
      localStorage.setItem(STORAGE_KEY_MATCHING_CURRICULUM, JSON.stringify(nextSubjects));
    } catch {}
    setStatusMessage({
      success: true,
      text: 'تم حذف التمرين بنجاح من القائمة المحلية.',
    });
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

  // Export / Populate all matching curriculum into sheet "وصل"
  const handleExportAllToSheets = async () => {
    if (!webhookUrl) {
      alert('يرجى التأكد من إدخال رابط Google Sheets Webhook أولاً في الإعدادات.');
      return;
    }

    if (!confirm('سيتم نقل وتصدير كافة تمارين التوصيل الحالية إلى ورقة (وصل) في Google Sheets. هل تود المتابعة؟')) {
      return;
    }

    setIsExporting(true);
    setStatusMessage(null);
    try {
      const res = await exportAllMatchingCurriculumToSheets(webhookUrl, subjects);
      if (res.success) {
        setStatusMessage({
          success: true,
          text: res.message,
        });
      } else {
        setStatusMessage({
          success: false,
          text: res.message || 'فشل نقل التمارين إلى ورقة وصل',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        success: false,
        text: 'حدث خطأ أثناء نقل التمارين إلى الشيت: ' + (err?.message || ''),
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 w-full animate-in fade-in duration-200">
      {/* Top Banner & Sub-tabs */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              🔗
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              إدارة تمارين الوصل (ورقة وصل)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            إضافة وتعديل وحذف أسئلة وأزواج الكلمات المترابطة المحفوظة في ورقة <strong>وصل</strong>
          </p>
        </div>

        {/* Action Buttons: Export to Sheets, List, Add/Edit */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Button: Export All to Sheet "وصل" */}
          <button
            type="button"
            onClick={handleExportAllToSheets}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            title="نقل وتصدير كافة التمارين إلى ورقة (وصل) في Google Sheets للتأكد من صحة الهيكل"
          >
            {isExporting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600" />
                <span>جاري النقل للشيت...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-3.5 h-3.5 text-purple-700" />
                <span>نقل التمارين لورقة وصل 📤</span>
              </>
            )}
          </button>

          <button
            onClick={() => setSubTab('list')}
            className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === 'list'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <List className="w-4 h-4" />
            <span>قائمة التمارين ({subjects.reduce((acc, s) => acc + s.exercises.length, 0)})</span>
          </button>

          <button
            onClick={() => {
              if (editingInfo) handleCancelEdit();
              setSubTab('add');
            }}
            className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === 'add'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>{editingInfo ? 'تعديل تمرين' : 'إضافة تمرين جديد'}</span>
          </button>

          <button
            onClick={handleRefreshFromSheet}
            disabled={isRefreshing}
            className="p-2 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 rounded-xl transition-all border border-slate-200 cursor-pointer disabled:opacity-50"
            title="جلب وتحديث التمارين من ورقة وصل"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-purple-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Notice */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in ${
            statusMessage.success
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-rose-50 text-rose-900 border-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Editing Banner */}
      {editingInfo && subTab === 'add' && (
        <div className="p-3 bg-purple-100 border border-purple-300 rounded-2xl flex items-center justify-between text-xs text-purple-950 font-bold">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-purple-700 shrink-0" />
            <span>
              أنت الآن في وضع <strong>تعديل التمرين {editingInfo.exerciseNumber}</strong>. قم بتعديل الكلمات أو السؤال ثم اضغط حفظ.
            </span>
          </div>
          <button
            type="button"
            onClick={handleCancelEdit}
            className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-800 rounded-xl border border-purple-200 transition-all cursor-pointer"
          >
            إلغاء التعديل
          </button>
        </div>
      )}

      {/* SUB-TAB 1: ADD / EDIT EXERCISE FORM */}
      {subTab === 'add' && (
        <form
          onSubmit={handleSaveExercise}
          className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-xs space-y-6"
        >
          {/* Section: Lesson Subject */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              موضوع الدرس (العامود A في ورقة وصل):
            </label>

            {!editingInfo ? (
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="subjectMode"
                    checked={selectedSubjectMode === 'existing'}
                    onChange={() => setSelectedSubjectMode('existing')}
                    className="accent-purple-600"
                  />
                  <span>اختيار من المواضيع الحالية</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="subjectMode"
                    checked={selectedSubjectMode === 'new'}
                    onChange={() => setSelectedSubjectMode('new')}
                    className="accent-purple-600"
                  />
                  <span>إضافة موضوع درس جديد</span>
                </label>
              </div>
            ) : null}

            {selectedSubjectMode === 'existing' ? (
              <select
                value={existingSubjectName}
                onChange={(e) => setExistingSubjectName(e.target.value)}
                disabled={!!editingInfo}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-hidden focus:border-purple-500 disabled:opacity-60"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.subjectName}>
                    {s.subjectName} ({s.exercises.length} تمارين حالية)
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="اكتب اسم موضوع الدرس الجديد (مثال: الجمع والمفرد، المترادفات...)"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-hidden focus:border-purple-500"
                required={selectedSubjectMode === 'new'}
              />
            )}
          </div>

          {/* Section: Question Text */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              نص السؤال (العامود الأول للتمرين في ورقة وصل):
            </label>
            <input
              type="text"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="مثال: صِلْ بَيْنَ الكَلِمَةِ وَضِدِّهَا المُنَاسِب"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-hidden focus:border-purple-500 font-amiri text-base"
              required
            />
          </div>

          {/* Section: Word Pairs Builder */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-900">
                  أزواج كلمات التوصيل (العامود 2 كلمات اليمين ⟷ العامود 3 كلمات اليسار):
                </label>
                <span className="text-[11px] text-slate-400">
                  (أدخل الكلمات المتقابلة بالترتيب؛ وسيقوم النظام بلخبطة عرضها عشوائياً للطلاب)
                </span>
              </div>
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

          {/* Section: Answer Behavior Controls (أزرار تحكم طريقة الإجابة والتصحيح) */}
          <div className="p-4 bg-purple-50/70 border border-purple-200/90 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-700" />
              <h4 className="text-xs font-black text-purple-950">
                خيارات طريقة الإجابة وسلوك التوصيل للطالب (تُحفظ في العامود 4 بورقة وصل):
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Control 1: طريقة إدخال الإجابة */}
              <div className="p-3 bg-white rounded-xl border border-purple-200 shadow-2xs space-y-2">
                <span className="text-[11px] font-extrabold text-slate-800 block">
                  1. أزرار الإدخال المتاحة للطالب:
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setInputMode('both')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                      inputMode === 'both'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🖱️🎙️ فأرة وصوت
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('voice_only')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                      inputMode === 'voice_only'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🎙️ صوت فقط
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  {inputMode === 'voice_only'
                    ? '✓ صوت فقط: سيظهر للطالب زر النطق فقط (يُخفى زر الفأرة لإلزام الطالب بالنطق والتوصيل الصوتي).'
                    : 'الافتراضي: يظهر للطالب زري الفأرة والصوت ويمكنه الاختيار بينهما بحرية.'}
                </p>
              </div>

              {/* Control 2: مدة الاستماع والعد التنازلي */}
              <div className="p-3 bg-white rounded-xl border border-purple-200 shadow-2xs space-y-2">
                <span className="text-[11px] font-extrabold text-slate-800 block">
                  2. مدة الاستماع والعد التنازلي:
                </span>
                <div className="flex items-center justify-between gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setDurationSeconds((prev) => Math.max(2, prev - 1))}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white hover:bg-purple-50 text-purple-700 font-black border border-slate-200 cursor-pointer text-sm shadow-2xs"
                  >
                    -
                  </button>
                  <span className="text-xs font-black text-purple-900 font-mono">
                    {durationSeconds} ثوانٍ
                  </span>
                  <button
                    type="button"
                    onClick={() => setDurationSeconds((prev) => Math.min(10, prev + 1))}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white hover:bg-purple-50 text-purple-700 font-black border border-slate-200 cursor-pointer text-sm shadow-2xs"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  يظهر عداد تنازلي على زر النطق للطالب: [ 🎙️ جاري الاستماع... ({durationSeconds} ث) ] ليمنح الطالب وقتاً كافياً.
                </p>
              </div>

              {/* Control 3: لا يمكن التراجع عن الإجابة */}
              <div className="p-3 bg-white rounded-xl border border-purple-200 shadow-2xs space-y-2">
                <span className="text-[11px] font-extrabold text-slate-800 block">
                  3. خيار التراجع عند الخطأ:
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLockOnMistake(false)}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                      !lockOnMistake
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🔄 إتاحة المحاولة
                  </button>
                  <button
                    type="button"
                    onClick={() => setLockOnMistake(true)}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                      lockOnMistake
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🔒 لا يمكن التراجع
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  {lockOnMistake
                    ? '✓ تم القفل: إذا أخطأ الطالب في توصيل كلمتين، يُثبّت التوصيل كخطأ نهائي ويُحسب خطأ ولا يمكن التراجع.'
                    : 'الافتراضي: عند الخطأ يومض باللون الأحمر ويُتاح للطالب التوصيل مرة أخرى حتى يصل للإجابة الصحيحة.'}
                </p>
              </div>

              {/* Control 4: إظهار / إخفاء الخطأ */}
              <div className="p-3 bg-white rounded-xl border border-purple-200 shadow-2xs space-y-2">
                <span className="text-[11px] font-extrabold text-slate-800 block">
                  4. إظهار / إخفاء الخطأ:
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowMistakeFeedback(true)}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                      showMistakeFeedback
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    👁️ إظهار الخطأ فوراً
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMistakeFeedback(false)}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                      !showMistakeFeedback
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🙈 إخفاء الخطأ
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  {showMistakeFeedback
                    ? 'الافتراضي: يظهر التنبيه الصوتي والمرئي فوراً للكلمات الصحيحة والخاطئة.'
                    : 'يتم التوصيل بصمت وهدوء دون إظهار الخطأ، وتظهر الدرجة والأخطاء فقط عند نهاية التمرين بالكامل.'}
                </p>
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            {editingInfo && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-all cursor-pointer"
              >
                إلغاء التعديل
              </button>
            )}

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
                  <span>{editingInfo ? 'تحديث وحفظ التعديلات' : 'حفظ التمرين إلى ورقة (وصل)'}</span>
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
                      className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-purple-200 transition-all"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 text-[10px] font-bold">
                            تمرين {ex.exerciseNumber}
                          </span>
                          {ex.inputMode === 'voice_only' && (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[9px] font-bold" title="إدخال صوتي فقط">
                              🎙️ صوت فقط
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-200/80 text-slate-700 text-[9px] font-bold" title="مدة الاستماع والعد التنازلي">
                            ⏱️ {ex.durationSeconds || 4}ث
                          </span>
                          {ex.lockOnMistake && (
                            <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[9px] font-bold" title="لا يمكن التراجع عند الخطأ">
                              🔒 لا تراجع
                            </span>
                          )}
                          {ex.showMistakeFeedback === false && (
                            <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[9px] font-bold" title="الخطأ مخفي حتى نهاية التمرين">
                              🙈 إخفاء الخطأ
                            </span>
                          )}
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

                      {/* Action buttons: Edit & Delete */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleStartEdit(subj, ex)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-purple-200"
                          title="تعديل هذا التمرين"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>تعديل</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteExercise(subj.id, ex.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
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
