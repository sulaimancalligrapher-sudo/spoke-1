import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MatchingLessonSubject,
  MatchingExercise,
  MatchingPair,
  StudentRegistrant,
} from '../types';
import { SupportedLang } from '../utils/translations';
import { submitMatchingAnswerToSheet } from '../utils/googleSheets';
import { createSpeechRecognizer, isSpeechRecognitionSupported } from '../utils/arabicAudio';
import { removeTashkeel } from '../utils/arabicMatcher';
import {
  Mic,
  MicOff,
  Sparkles,
  Award,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Volume2,
  BookOpen,
  Send,
  Loader2,
  User,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface WordMatchingArenaProps {
  subjects: MatchingLessonSubject[];
  currentStudent: StudentRegistrant | null;
  webhookUrl?: string;
  currentLang?: SupportedLang;
  t?: (id: string, fallback?: string) => string;
  onOpenLogin?: () => void;
  onRequestLogin?: () => void;
  onGoToPronunciation?: () => void;
  onBackToPronunciation?: () => void;
}

interface ShuffledItem {
  id: string; // unique item id
  text: string;
  pairId: string; // ID of the pair it belongs to
}

// Simple synthesizer for instant chime effects without external assets
function playAudioChime(type: 'success' | 'error' | 'tap') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (type === 'success') {
      // Pleasant rising major chord
      const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.12, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.35);
      });
    } else if (type === 'error') {
      // Gentle soft error buzz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else {
      // Subtle tap click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  } catch {}
}

export const WordMatchingArena: React.FC<WordMatchingArenaProps> = ({
  subjects,
  currentStudent,
  webhookUrl,
  currentLang = 'ar',
  t,
  onOpenLogin,
  onRequestLogin,
  onGoToPronunciation,
  onBackToPronunciation,
}) => {
  const tr = (id: string, fallback: string) => (t ? t(id, fallback) : fallback);
  const handleTriggerLogin = onRequestLogin || onOpenLogin || (() => {});
  const handleTriggerPronunciation = onBackToPronunciation || onGoToPronunciation || (() => {});

  // Active Subject & Exercise
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    subjects[0]?.id || ''
  );
  const [exerciseIndex, setExerciseIndex] = useState<number>(0);

  // Keep selectedSubject in sync if subjects change
  useEffect(() => {
    if (!selectedSubjectId && subjects.length > 0) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [subjects, selectedSubjectId]);

  const activeSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId) || subjects[0] || null;
  }, [subjects, selectedSubjectId]);

  const activeExercise: MatchingExercise | null = useMemo(() => {
    if (!activeSubject || !activeSubject.exercises.length) return null;
    return activeSubject.exercises[exerciseIndex] || activeSubject.exercises[0];
  }, [activeSubject, exerciseIndex]);

  // Shuffled columns
  const [rightItems, setRightItems] = useState<ShuffledItem[]>([]);
  const [leftItems, setLeftItems] = useState<ShuffledItem[]>([]);

  // Selection states
  const [selectedRightId, setSelectedRightId] = useState<string | null>(null);
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);

  // Completed connections in current exercise
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);
  const [incorrectFlashIds, setIncorrectFlashIds] = useState<{ rightId: string; leftId: string } | null>(null);

  // Score tracking for current exercise
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Student progress in this subject (number of exercises completed so far)
  const [completedExercisesInSubject, setCompletedExercisesInSubject] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [sheetSyncSuccess, setSheetSyncSuccess] = useState<string | null>(null);

  // Speech Recognition
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechHint, setSpeechHint] = useState<string | null>(null);
  const recognizerRef = useRef<any>(null);

  // Initialize or re-shuffle when activeExercise changes
  const initExercise = () => {
    if (!activeExercise || !activeExercise.pairs.length) return;

    // Shuffle right items
    const rights: ShuffledItem[] = activeExercise.pairs.map((p, idx) => ({
      id: `r-${p.id}-${idx}`,
      text: p.rightText,
      pairId: p.id,
    }));
    const shuffledR = [...rights].sort(() => Math.random() - 0.5);

    // Shuffle left items
    const lefts: ShuffledItem[] = activeExercise.pairs.map((p, idx) => ({
      id: `l-${p.id}-${idx}`,
      text: p.leftText,
      pairId: p.id,
    }));
    const shuffledL = [...lefts].sort(() => Math.random() - 0.5);

    setRightItems(shuffledR);
    setLeftItems(shuffledL);
    setSelectedRightId(null);
    setSelectedLeftId(null);
    setMatchedPairIds([]);
    setIncorrectFlashIds(null);
    setCorrectCount(0);
    setWrongCount(0);
    setIsCompleted(false);
    setSheetSyncSuccess(null);
    setSpeechHint(null);
  };

  useEffect(() => {
    initExercise();
  }, [activeExercise]);

  // Handle Match Evaluation between selectedRightId and selectedLeftId
  const handleCheckMatch = (rId: string, lId: string) => {
    const rItem = rightItems.find((i) => i.id === rId);
    const lItem = leftItems.find((i) => i.id === lId);
    if (!rItem || !lItem) return;

    if (rItem.pairId === lItem.pairId) {
      // Correct Match!
      playAudioChime('success');
      const newMatched = [...matchedPairIds, rItem.pairId];
      setMatchedPairIds(newMatched);
      setCorrectCount((prev) => prev + 1);
      setSelectedRightId(null);
      setSelectedLeftId(null);

      // Check if all pairs are solved
      if (activeExercise && newMatched.length >= activeExercise.pairs.length) {
        handleExerciseFinished(correctCount + 1, wrongCount);
      }
    } else {
      // Wrong Match!
      playAudioChime('error');
      setWrongCount((prev) => prev + 1);
      setIncorrectFlashIds({ rightId: rId, leftId: lId });
      setTimeout(() => {
        setIncorrectFlashIds(null);
        setSelectedRightId(null);
        setSelectedLeftId(null);
      }, 700);
    }
  };

  // When exercise finishes, auto-submit to sheet "answers 2"
  const handleExerciseFinished = async (finalCorrect: number, finalWrong: number) => {
    setIsCompleted(true);
    if (!activeExercise || !activeSubject) return;

    const totalPairs = activeExercise.pairs.length;
    // Calculate percentage: correct / (correct + wrong) or based on accuracy
    const totalAttempts = Math.max(totalPairs, finalCorrect + finalWrong);
    const percentage = Math.round((finalCorrect / totalAttempts) * 100);

    // Update completed count
    const updatedCompleted = {
      ...completedExercisesInSubject,
      [activeExercise.exerciseNumber]: percentage,
    };
    setCompletedExercisesInSubject(updatedCompleted);

    const totalInSubject = activeSubject.exercises.length;
    const completedCount = Object.keys(updatedCompleted).length;
    const scoresArr = Object.values(updatedCompleted);
    const overallPercentage = Math.round(
      scoresArr.reduce((a, b) => a + b, 0) / Math.max(1, scoresArr.length)
    );

    // Auto-sync to sheet "answers 2" if student is registered and webhook is active
    if (webhookUrl && currentStudent) {
      setIsSubmitting(true);
      try {
        const res = await submitMatchingAnswerToSheet(webhookUrl, {
          studentId: currentStudent.id,
          studentName: currentStudent.name,
          subjectName: activeSubject.subjectName,
          exerciseNumber: activeExercise.exerciseNumber,
          totalPairs,
          correctCount: finalCorrect,
          wrongCount: finalWrong,
          percentage,
          totalExercisesInSubject: totalInSubject,
          completedCountInSubject: completedCount,
          overallPercentage,
        });
        if (res.success) {
          setSheetSyncSuccess('تم توثيق إنجازك بنجاح في ورقة answers 2 ✓');
        }
      } catch (err) {
        console.warn('Failed to submit to answers 2:', err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // User click on right column card
  const handleRightCardClick = (item: ShuffledItem) => {
    if (matchedPairIds.includes(item.pairId) || isCompleted) return;
    playAudioChime('tap');

    if (selectedRightId === item.id) {
      setSelectedRightId(null);
      return;
    }

    setSelectedRightId(item.id);

    // If a left item is already selected, test match!
    if (selectedLeftId) {
      handleCheckMatch(item.id, selectedLeftId);
    }
  };

  // User click on left column card
  const handleLeftCardClick = (item: ShuffledItem) => {
    if (matchedPairIds.includes(item.pairId) || isCompleted) return;
    playAudioChime('tap');

    if (selectedLeftId === item.id) {
      setSelectedLeftId(null);
      return;
    }

    setSelectedLeftId(item.id);

    // If a right item is already selected, test match!
    if (selectedRightId) {
      handleCheckMatch(selectedRightId, item.id);
    }
  };

  // Speech Recognition (Voice Mode)
  const toggleSpeechRecognition = () => {
    if (isListening) {
      if (recognizerRef.current) {
        recognizerRef.current.abort();
      }
      setIsListening(false);
      setSpeechHint(null);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      alert('خاصية التعرف الصوتي غير مدعومة في هذا المتصفح. يمكنك التوصيل باللمس أو الفأرة بسهولة.');
      return;
    }

    try {
      const recognizer = createSpeechRecognizer(
        (transcript: string) => {
          const trimmed = (transcript || '').trim();
          if (trimmed) {
            setSpeechHint(`سُمع: "${trimmed}"`);
            handleVoiceSearchWord(trimmed);
          }
        },
        (_error: string) => {
          setIsListening(false);
          setSpeechHint('لم يتم التقاط نطق واضح. اضغط الميكروفون وحاول مجدداً.');
        },
        () => {
          setIsListening(false);
        }
      );
      if (!recognizer) return;
      recognizerRef.current = recognizer;
      setIsListening(true);
      setSpeechHint('استمع لصوتك... انطق أي كلمة ظاهرة أمامك');
      recognizer.start();
    } catch {
      setIsListening(false);
    }
  };

  // Match spoken word against right or left cards
  const handleVoiceSearchWord = (spokenText: string) => {
    const cleanSpoken = removeTashkeel(spokenText).toLowerCase();

    // 1. If right item is not yet selected, search right items first
    if (!selectedRightId) {
      const matchR = rightItems.find((item) => {
        if (matchedPairIds.includes(item.pairId)) return false;
        const cleanItem = removeTashkeel(item.text).toLowerCase();
        return cleanSpoken.includes(cleanItem) || cleanItem.includes(cleanSpoken);
      });

      if (matchR) {
        setSelectedRightId(matchR.id);
        playAudioChime('tap');
        setSpeechHint(`✓ تم تحديد: ${matchR.text} - الآن انطق الكلمة المقابلة في اليسار`);
        return;
      }
    }

    // 2. Search left items
    const matchL = leftItems.find((item) => {
      if (matchedPairIds.includes(item.pairId)) return false;
      const cleanItem = removeTashkeel(item.text).toLowerCase();
      return cleanSpoken.includes(cleanItem) || cleanItem.includes(cleanSpoken);
    });

    if (matchL) {
      if (selectedRightId) {
        // Execute match!
        handleCheckMatch(selectedRightId, matchL.id);
        setSpeechHint(`تم محاولة توصيل الكلمتين`);
      } else {
        setSelectedLeftId(matchL.id);
        playAudioChime('tap');
        setSpeechHint(`✓ تم تحديد: ${matchL.text} - الآن انطق الكلمة المقابلة في اليمين`);
      }
      return;
    }

    // If not found in either column
    playAudioChime('error');
    setSpeechHint(`الكلمة "${spokenText}" غير متطابقة مع الكلمات المتبقية.`);
  };

  // Navigation handlers
  const handleNextExercise = () => {
    if (!activeSubject) return;
    const nextIdx = (exerciseIndex + 1) % activeSubject.exercises.length;
    setExerciseIndex(nextIdx);
  };

  const handlePrevExercise = () => {
    if (!activeSubject) return;
    const prevIdx =
      (exerciseIndex - 1 + activeSubject.exercises.length) % activeSubject.exercises.length;
    setExerciseIndex(prevIdx);
  };

  if (!activeSubject || !activeExercise) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center">
        <HelpCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800 mb-2">لا توجد تمارين وصل متاحة حالياً</h3>
        <p className="text-xs text-slate-500 mb-4">
          يمكن للمعلم إضافة تمارين جديدة في ورقة "وصل" أو من خلال لوحة التحكم.
        </p>
        <button
          onClick={handleTriggerPronunciation}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
        >
          الانتقال لتمرين نطق الكلمات 🎙️
        </button>
      </div>
    );
  }

  const totalPairsCount = activeExercise.pairs.length;
  const remainingCount = totalPairsCount - matchedPairIds.length;
  const accuracyPercent = Math.round(
    (correctCount / Math.max(1, correctCount + wrongCount)) * 100
  );

  return (
    <div className="flex flex-col gap-5 w-full animate-in fade-in duration-300">
      {/* 1. Header Toolbar: Subject & Exercise Selector + Voice Toggle */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Subject dropdown */}
        <div className="w-full md:w-auto flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>موضوع الدرس:</span>
          </div>

          <select
            value={selectedSubjectId}
            onChange={(e) => {
              setSelectedSubjectId(e.target.value);
              setExerciseIndex(0);
            }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs sm:text-sm font-bold text-slate-800 cursor-pointer focus:outline-hidden"
          >
            {subjects.map((subj) => (
              <option key={subj.id} value={subj.id}>
                {subj.subjectName} ({subj.exercises.length} تمارين)
              </option>
            ))}
          </select>
        </div>

        {/* Exercise Pagination / Step */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevExercise}
              disabled={exerciseIndex === 0}
              className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 cursor-pointer disabled:cursor-not-allowed transition-all"
              title="التمرين السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900 font-extrabold text-xs">
              التمرين {activeExercise.exerciseNumber} من {activeSubject.exercises.length}
            </span>

            <button
              onClick={handleNextExercise}
              disabled={exerciseIndex >= activeSubject.exercises.length - 1}
              className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 cursor-pointer disabled:cursor-not-allowed transition-all"
              title="التمرين التالي"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Voice Microphone Toggle */}
          <button
            onClick={toggleSpeechRecognition}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}
            title="تفعيل التعرف الصوتي للتوصيل بالنطق"
          >
            {isListening ? (
              <>
                <MicOff className="w-3.5 h-3.5" />
                <span>جاري الاستماع...</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 text-emerald-600" />
                <span>التوصيل بالصوت 🎙️</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Voice Hint banner if listening */}
      {speechHint && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2 text-xs font-semibold text-amber-900 flex items-center justify-between gap-2 animate-in fade-in">
          <span>{speechHint}</span>
          {isListening && <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />}
        </div>
      )}

      {/* 2. Main Question Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
        {/* Question Text */}
        <div className="mb-2">
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 mb-2">
            سؤال التوصيل
          </span>
          <h2 className="text-xl sm:text-2xl font-black font-amiri text-slate-900 tracking-wide">
            {activeExercise.questionText}
          </h2>
        </div>

        {/* Live Status Bar */}
        <div className="flex items-center gap-4 text-xs font-bold my-3 px-4 py-1.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <span className="text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> الصحيح: {correctCount}
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-rose-600 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> الخطأ: {wrongCount}
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-600">
            المتبقي: {remainingCount} من {totalPairsCount}
          </span>
        </div>

        {/* 3. The Two Columns (Right Words & Left Words) */}
        {!isCompleted ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 w-full max-w-2xl my-4">
            {/* RIGHT COLUMN */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-extrabold text-slate-400 block mb-1">
                العمود الأيمن
              </span>
              {rightItems.map((item) => {
                const isMatched = matchedPairIds.includes(item.pairId);
                const isSelected = selectedRightId === item.id;
                const isFlashingWrong = incorrectFlashIds?.rightId === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleRightCardClick(item)}
                    disabled={isMatched}
                    className={`w-full p-3 sm:p-4 rounded-2xl border-2 font-amiri text-lg sm:text-2xl font-bold transition-all flex items-center justify-between cursor-pointer active:scale-98 select-none ${
                      isMatched
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 opacity-60 cursor-default'
                        : isFlashingWrong
                        ? 'bg-rose-50 border-rose-500 text-rose-900 animate-shake'
                        : isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-102 ring-4 ring-indigo-200'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs hover:border-indigo-300'
                    }`}
                  >
                    <span className="truncate">{item.text}</span>
                    {isMatched && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* LEFT COLUMN */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-extrabold text-slate-400 block mb-1">
                العمود الأيسر
              </span>
              {leftItems.map((item) => {
                const isMatched = matchedPairIds.includes(item.pairId);
                const isSelected = selectedLeftId === item.id;
                const isFlashingWrong = incorrectFlashIds?.leftId === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleLeftCardClick(item)}
                    disabled={isMatched}
                    className={`w-full p-3 sm:p-4 rounded-2xl border-2 font-amiri text-lg sm:text-2xl font-bold transition-all flex items-center justify-between cursor-pointer active:scale-98 select-none ${
                      isMatched
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 opacity-60 cursor-default'
                        : isFlashingWrong
                        ? 'bg-rose-50 border-rose-500 text-rose-900 animate-shake'
                        : isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-102 ring-4 ring-indigo-200'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs hover:border-indigo-300'
                    }`}
                  >
                    <span className="truncate">{item.text}</span>
                    {isMatched && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* 4. Exercise Completion Card */
          <div className="w-full max-w-lg p-6 bg-linear-to-b from-emerald-50 to-teal-50/40 border border-emerald-200 rounded-3xl text-center my-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md shadow-emerald-600/20">
              <Award className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-black text-emerald-950 mb-1">
              ما شاء الله! أحسنت إكمال تمرين الوصل
            </h3>

            {/* The exact requested result formula string */}
            <div className="my-3 py-2.5 px-4 bg-white/90 border border-emerald-200 rounded-2xl text-center shadow-xs">
              <span className="text-xs font-bold text-slate-400 block mb-0.5">صيغة النتيجة الرسمية</span>
              <span className="text-base sm:text-lg font-black font-cairo text-emerald-800">
                ({totalPairsCount} - الصحيح {correctCount} - الخطأ {wrongCount} = {accuracyPercent}%)
              </span>
            </div>

            {/* Sync Status with answers 2 */}
            <div className="text-xs font-bold text-emerald-700 mb-4 flex items-center justify-center gap-1.5">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري توثيق النتيجة في ورقة answers 2...</span>
                </>
              ) : sheetSyncSuccess ? (
                <span>{sheetSyncSuccess}</span>
              ) : !currentStudent ? (
                <div className="bg-amber-50 border border-amber-200 p-2 rounded-xl text-amber-900 text-[11px]">
                  <span>سجّل دخولك لتوثيق نتائجك تلقائياً في ورقة answers 2</span>
                  <button
                    onClick={handleTriggerLogin}
                    className="block mx-auto mt-1 px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    دخول الطالب
                  </button>
                </div>
              ) : null}
            </div>

            {/* Bottom Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={initExercise}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-all cursor-pointer active:scale-98"
              >
                <RotateCcw className="w-4 h-4 text-slate-500" />
                <span>إعادة التمرين</span>
              </button>

              <button
                onClick={handleNextExercise}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer active:scale-98"
              >
                <span>التمرين التالي</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </button>
            </div>
          </div>
        )}

        {/* Re-shuffle button during active exercise */}
        {!isCompleted && (
          <div className="mt-2 flex items-center justify-center gap-3">
            <button
              onClick={initExercise}
              className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1 font-semibold cursor-pointer transition-colors"
              title="إعادة خلط وترتيب الكلمات"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة خلط الكلمات 🔀</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
