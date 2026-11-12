import React, { useState, useMemo } from 'react';
import { MatchingLessonSubject, MatchingExercise } from '../types';
import {
  X,
  Sparkles,
  BookOpen,
  ArrowRight,
  Layers,
  Search,
  CheckCircle2,
  ListOrdered,
} from 'lucide-react';

interface MatchingLessonsModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: MatchingLessonSubject[];
  activeSubjectId?: string;
  activeExerciseIndex?: number;
  onSelectSubjectExercise: (subjectId: string, exerciseIndex: number) => void;
  onOpenAdminMatching?: () => void;
}

export const MatchingLessonsModal: React.FC<MatchingLessonsModalProps> = ({
  isOpen,
  onClose,
  subjects,
  activeSubjectId,
  activeExerciseIndex = 0,
  onSelectSubjectExercise,
  onOpenAdminMatching,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    activeSubjectId || subjects[0]?.id || ''
  );

  // Update selectedSubjectId if activeSubjectId changes
  React.useEffect(() => {
    if (activeSubjectId) {
      setSelectedSubjectId(activeSubjectId);
    } else if (subjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [activeSubjectId, subjects]);

  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return subjects;
    const q = searchQuery.trim().toLowerCase();
    return subjects.filter(
      (s) =>
        s.subjectName.toLowerCase().includes(q) ||
        s.exercises.some((e) =>
          e.questionText.toLowerCase().includes(q) ||
          e.pairs.some(
            (p) =>
              p.rightText.toLowerCase().includes(q) ||
              p.leftText.toLowerCase().includes(q)
          )
        )
    );
  }, [subjects, searchQuery]);

  const currentSubject = useMemo(() => {
    return (
      filteredSubjects.find((s) => s.id === selectedSubjectId) ||
      filteredSubjects[0] ||
      null
    );
  }, [filteredSubjects, selectedSubjectId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-7 shadow-2xl border border-slate-100 relative max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute left-5 top-5 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          title="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-linear-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-purple-600/20">
            <Sparkles className="w-6 h-6 text-purple-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 font-amiri tracking-wide">
                قائمة دروس وتمارين وصل الكلمات 🔗
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-200">
                ورقة وصل
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              اختر الدرس والتمرين المناسب لبدء التوصيل بالفأرة أو بالصوت
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="my-4 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن موضوع أو سؤال أو كلمة..."
            className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
        </div>

        {/* Body: Two columns layout (Subjects List on right, Exercises Detail on left) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Subjects List */}
          <div className="md:col-span-5 border border-slate-200 rounded-2xl p-2 overflow-y-auto space-y-1.5 max-h-[46vh] md:max-h-full">
            <span className="text-[11px] font-extrabold text-slate-400 px-2 block py-1">
              مواضيع الدروس ({filteredSubjects.length})
            </span>
            {filteredSubjects.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                لا توجد مواضيع مطابقة للبحث
              </div>
            ) : (
              filteredSubjects.map((subj) => {
                const isSelected = subj.id === currentSubject?.id;
                return (
                  <button
                    key={subj.id}
                    onClick={() => setSelectedSubjectId(subj.id)}
                    className={`w-full text-right p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between border ${
                      isSelected
                        ? 'bg-purple-50 border-purple-300 text-purple-950 font-extrabold shadow-2xs'
                        : 'bg-white hover:bg-slate-50 border-transparent text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <BookOpen
                        className={`w-4 h-4 shrink-0 ${
                          isSelected ? 'text-purple-600' : 'text-slate-400'
                        }`}
                      />
                      <span className="text-xs sm:text-sm truncate">
                        {subj.subjectName}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 shrink-0">
                      {subj.exercises.length} تمارين
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Exercises in Selected Subject */}
          <div className="md:col-span-7 border border-slate-200 rounded-2xl p-3 sm:p-4 overflow-y-auto flex flex-col justify-between max-h-[46vh] md:max-h-full bg-slate-50/50">
            {currentSubject ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                  <div>
                    <span className="text-[10px] font-bold text-purple-700">الموضوع المحدد:</span>
                    <h3 className="text-base font-extrabold text-slate-900 font-amiri">
                      {currentSubject.subjectName}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-bold">
                    إجمالي {currentSubject.exercises.length} تمارين
                  </span>
                </div>

                {/* Exercises Cards */}
                <div className="space-y-2.5">
                  {currentSubject.exercises.map((ex, exIdx) => {
                    const isCurrent =
                      currentSubject.id === activeSubjectId &&
                      exIdx === activeExerciseIndex;

                    return (
                      <div
                        key={ex.id || exIdx}
                        className={`p-3 rounded-2xl border transition-all ${
                          isCurrent
                            ? 'bg-purple-100/60 border-purple-300 ring-2 ring-purple-300'
                            : 'bg-white border-slate-200/80 hover:border-purple-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1">
                            <ListOrdered className="w-3 h-3 text-purple-600" />
                            <span>تمرين {ex.exerciseNumber}</span>
                          </span>

                          <button
                            onClick={() => {
                              onSelectSubjectExercise(currentSubject.id, exIdx);
                              onClose();
                            }}
                            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <span>بدء التمرين</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>

                        <h4 className="text-sm font-bold text-slate-800 font-amiri">
                          {ex.questionText}
                        </h4>

                        {/* Words preview pills */}
                        <div className="mt-2 flex flex-wrap gap-1 text-[11px] font-amiri">
                          {ex.pairs.map((p, pIdx) => (
                            <span
                              key={pIdx}
                              className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200/70"
                            >
                              {p.rightText} ⟷ {p.leftText}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs">
                اختر موضوعاً لعرض تمارينه
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 mt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          {onOpenAdminMatching && (
            <button
              onClick={() => {
                onClose();
                onOpenAdminMatching();
              }}
              className="text-xs text-purple-700 hover:text-purple-900 font-bold flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>إدارة وإضافة تمارين وصل جديدة في لوحة التحكم</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer mr-auto"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
