import React, { useState, useEffect } from 'react';
import {
  WordItem,
  PronunciationEvaluation,
  PracticeHistoryItem,
  AudioSettings,
  GoogleSheetsConfig,
  StudentSubmissionRecord,
  EvaluationMode,
} from './types';
import {
  ALL_CURRICULUM,
  INITIAL_CATEGORIES,
  INITIAL_LESSON_SUBJECTS,
} from './data/arabicCurriculum';
import { Navbar } from './components/Navbar';
import { PracticeCard } from './components/PracticeCard';
import { EvaluationCard } from './components/EvaluationCard';
import { CurriculumDrawer } from './components/CurriculumDrawer';
import { StatsModal } from './components/StatsModal';
import { SettingsModal } from './components/SettingsModal';
import { GuideModal } from './components/GuideModal';
import { AdminPanel } from './components/AdminPanel';
import {
  sendScoreToGoogleSheets,
  fetchCurriculumFromSheets,
  DEFAULT_WEBHOOK_URL,
  DEFAULT_DRIVE_AUDIO_FOLDER_ID,
} from './utils/googleSheets';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Sliders,
  BookOpen,
} from 'lucide-react';

const STORAGE_KEY_HISTORY = 'faseeh_pronunciation_history_v1';
const STORAGE_KEY_SCORES = 'faseeh_pronunciation_scores_v1';
const STORAGE_KEY_CUSTOM = 'faseeh_custom_words_v2';
const STORAGE_KEY_SETTINGS = 'faseeh_audio_settings_v1';
const STORAGE_KEY_SHEETS = 'faseeh_sheets_config_v1';
const STORAGE_KEY_SUBMISSIONS = 'faseeh_submissions_v1';
const STORAGE_KEY_CATEGORIES = 'faseeh_categories_v2';
const STORAGE_KEY_SUBJECTS = 'faseeh_subjects_v2';

const isMobileDevicePlatform = () => {
  if (typeof navigator === 'undefined') return false;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1)
  );
};

export default function App() {
  const [curriculum, setCurriculum] = useState<WordItem[]>(ALL_CURRICULUM);
  const [categories, setCategories] = useState<string[]>(INITIAL_CATEGORIES);
  const [subjects, setSubjects] = useState<string[]>(INITIAL_LESSON_SUBJECTS);
  const [selectedItem, setSelectedItem] = useState<WordItem>(ALL_CURRICULUM[0]);
  const [evaluation, setEvaluation] = useState<PronunciationEvaluation | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [streak, setStreak] = useState(0);

  // Separate Admin View routing (supports URL: #admin or pathname /admin)
  const [isAdminView, setIsAdminView] = useState(false);

  // Student View: Active Lesson Subject
  const [studentSubject, setStudentSubject] = useState<string>(
    ALL_CURRICULUM[0]?.lessonSubject || INITIAL_LESSON_SUBJECTS[0]
  );

  // Modals
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(true);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Scores map: wordId -> score
  const [scoresMap, setScoresMap] = useState<Record<string, number>>({});
  // Practice History
  const [history, setHistory] = useState<PracticeHistoryItem[]>([]);

  // Google Sheets Config (Defaulted to verified Webhook URL for seamless cross-device sync)
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig>({
    enabled: true,
    webhookUrl: DEFAULT_WEBHOOK_URL,
    autoSync: true,
    syncCurriculumFromSheets: true,
    driveFolderId: DEFAULT_DRIVE_AUDIO_FOLDER_ID,
  });

  // Student Submissions Log
  const [submissions, setSubmissions] = useState<StudentSubmissionRecord[]>([]);

  // Settings: Defaults to 'whisper' (In-Browser WebAssembly Whisper) across all devices and browsers
  const [settings, setSettings] = useState<AudioSettings>({
    speed: 0.9,
    engine: 'browser',
    autoPlayTarget: false,
    repeatTargetTwice: false,
    preferredEvaluationMode: 'whisper',
    studentName: '',
  });

  // Check URL hash for admin routing and device sync on mount and hashchange
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      const path = window.location.pathname.toLowerCase();

      // Check for mobile/tablet sync payload (#sync=...)
      if (hash.startsWith('#sync=')) {
        try {
          const raw = decodeURIComponent(hash.substring(6));
          const parsed = JSON.parse(raw);

          // Format 1: Ultra-compact format ({ cw: [...], cs: [...], cc: [...] }) for instant QR & short link
          if (parsed && Array.isArray(parsed.cw)) {
            const restoredCustomWords: WordItem[] = parsed.cw.map((cwItem: any) => ({
              id: cwItem.id || `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              word: cwItem.w || '',
              plainWord: cwItem.p || cwItem.w || '',
              meaning: cwItem.m || '',
              category: cwItem.c || 'أخرى',
              lessonSubject: cwItem.s || 'دروس إضافية',
              audioUrl: cwItem.a || undefined,
              autoReadText: cwItem.t || undefined,
              imageUrl: cwItem.img || undefined,
              makhrajTip: cwItem.tip || undefined,
            }));

            // Merge with ALL_CURRICULUM
            const customIds = new Set(restoredCustomWords.map((w) => w.id));
            const mergedCurriculum = [
              ...ALL_CURRICULUM.filter((item) => !customIds.has(item.id)),
              ...restoredCustomWords,
            ];

            setCurriculum(mergedCurriculum);
            localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(mergedCurriculum));

            if (Array.isArray(parsed.cc) && parsed.cc.length > 0) {
              const mergedCats = Array.from(new Set([...INITIAL_CATEGORIES, ...parsed.cc]));
              setCategories(mergedCats);
              localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(mergedCats));
            }
            if (Array.isArray(parsed.cs) && parsed.cs.length > 0) {
              const mergedSubjs = Array.from(new Set([...INITIAL_LESSON_SUBJECTS, ...parsed.cs]));
              setSubjects(mergedSubjs);
              localStorage.setItem(STORAGE_KEY_SUBJECTS, JSON.stringify(mergedSubjs));
            }

            if (restoredCustomWords.length > 0) {
              setSelectedItem(restoredCustomWords[0]);
              setStudentSubject(restoredCustomWords[0].lessonSubject || '');
            } else if (mergedCurriculum.length > 0) {
              setSelectedItem(mergedCurriculum[0]);
              setStudentSubject(mergedCurriculum[0].lessonSubject || '');
            }

            setSyncNotice(`🎉 تمت مزامنة ${restoredCustomWords.length} درس وكلمة جديدة بنجاح إلى هذا الجهاز!`);
            window.history.replaceState(null, '', window.location.pathname);
            setTimeout(() => setSyncNotice(null), 6000);
            return;
          }

          // Format 2: Full curriculum array format
          if (parsed && Array.isArray(parsed.curriculum)) {
            setCurriculum(parsed.curriculum);
            localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(parsed.curriculum));

            if (Array.isArray(parsed.categories)) {
              setCategories(parsed.categories);
              localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(parsed.categories));
            }
            if (Array.isArray(parsed.subjects)) {
              setSubjects(parsed.subjects);
              localStorage.setItem(STORAGE_KEY_SUBJECTS, JSON.stringify(parsed.subjects));
            }
            if (parsed.curriculum.length > 0) {
              setSelectedItem(parsed.curriculum[0]);
              setStudentSubject(parsed.curriculum[0].lessonSubject || parsed.subjects?.[0] || '');
            }

            setSyncNotice(`🎉 تمت مزامنة ${parsed.curriculum.length} كلمة ودرس بنجاح إلى هذا الجهاز!`);
            window.history.replaceState(null, '', window.location.pathname);
            setTimeout(() => setSyncNotice(null), 6000);
            return;
          }
        } catch (e) {
          console.warn('Sync payload parse error:', e);
        }
      }

      if (hash.toLowerCase() === '#admin' || path === '/admin') {
        setIsAdminView(true);
      } else {
        setIsAdminView(false);
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // Load from local storage
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (savedHistory) setHistory(JSON.parse(savedHistory));

      const savedScores = localStorage.getItem(STORAGE_KEY_SCORES);
      if (savedScores) setScoresMap(JSON.parse(savedScores));

      const savedCustom = localStorage.getItem(STORAGE_KEY_CUSTOM);
      if (savedCustom) {
        const customItems: WordItem[] = JSON.parse(savedCustom);
        setCurriculum(customItems);
        if (customItems.length > 0) {
          setSelectedItem(customItems[0]);
          setStudentSubject(customItems[0].lessonSubject || INITIAL_LESSON_SUBJECTS[0]);
        }
      }

      const savedCategories = localStorage.getItem(STORAGE_KEY_CATEGORIES);
      if (savedCategories) setCategories(JSON.parse(savedCategories));

      const savedSubjects = localStorage.getItem(STORAGE_KEY_SUBJECTS);
      if (savedSubjects) setSubjects(JSON.parse(savedSubjects));

      const savedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({
          ...parsed,
          preferredEvaluationMode: parsed.preferredEvaluationMode || 'whisper',
        });
      }

      const savedSheets = localStorage.getItem(STORAGE_KEY_SHEETS);
      let activeConfig: GoogleSheetsConfig = {
        enabled: true,
        webhookUrl: DEFAULT_WEBHOOK_URL,
        autoSync: true,
        syncCurriculumFromSheets: true,
        driveFolderId: DEFAULT_DRIVE_AUDIO_FOLDER_ID,
      };

      if (savedSheets) {
        try {
          const parsedSheets: GoogleSheetsConfig = JSON.parse(savedSheets);
          activeConfig = {
            ...activeConfig,
            ...parsedSheets,
            webhookUrl: parsedSheets.webhookUrl || DEFAULT_WEBHOOK_URL,
            driveFolderId: parsedSheets.driveFolderId || DEFAULT_DRIVE_AUDIO_FOLDER_ID,
          };
        } catch (e) {
          console.warn('Error reading saved sheets config:', e);
        }
      }
      setSheetsConfig(activeConfig);

      // Auto-fetch lessons directly from sheet "الدروس" so mobile & tablet devices always get the latest curriculum
      if (activeConfig.webhookUrl && activeConfig.syncCurriculumFromSheets !== false) {
        fetchCurriculumFromSheets(activeConfig.webhookUrl)
          .then((res) => {
            if (res.success && res.curriculum && res.curriculum.length > 0) {
              setCurriculum(res.curriculum);
              if (res.subjects && res.subjects.length > 0) {
                setSubjects(res.subjects);
                localStorage.setItem(STORAGE_KEY_SUBJECTS, JSON.stringify(res.subjects));
              }
              if (res.categories && res.categories.length > 0) {
                setCategories(res.categories);
                localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(res.categories));
              }
              localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(res.curriculum));

              // If current item is not in fetched curriculum, update selected item
              setSelectedItem((prev) => {
                const found = res.curriculum!.find((item) => item.id === prev?.id || item.word === prev?.word);
                return found || res.curriculum![0];
              });
              if (res.curriculum[0]?.lessonSubject) {
                setStudentSubject((prev) => {
                  if (res.subjects?.includes(prev)) return prev;
                  return res.curriculum![0].lessonSubject || prev;
                });
              }

              setSyncNotice(`🎉 تمت مزامنة الدروس الحية من Google Sheets (${res.curriculum.length} كلمة)`);
              setTimeout(() => setSyncNotice(null), 4000);
            }
          })
          .catch((err) => {
            console.warn('Auto-sync from Google Sheets on startup notice:', err);
          });
      }

      const savedSubmissions = localStorage.getItem(STORAGE_KEY_SUBMISSIONS);
      if (savedSubmissions) setSubmissions(JSON.parse(savedSubmissions));
    } catch (e) {
      console.warn('LocalStorage load error:', e);
    }
  }, []);

  // Save history and scores
  const saveHistoryItem = (item: PracticeHistoryItem) => {
    setHistory((prev) => {
      const next = [item, ...prev].slice(0, 50);
      try {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    setScoresMap((prev) => {
      const next = { ...prev, [item.wordId]: item.score };
      try {
        localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleUpdateSettings = (newSettings: Partial<AudioSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleUpdateSheetsConfig = (newConfig: Partial<GoogleSheetsConfig>) => {
    setSheetsConfig((prev) => {
      const next = { ...prev, ...newConfig };
      try {
        localStorage.setItem(STORAGE_KEY_SHEETS, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  // Category Management
  const handleAddCategory = (newCategory: string) => {
    setCategories((prev) => {
      if (prev.includes(newCategory)) return prev;
      const next = [...prev, newCategory];
      try {
        localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleRenameCategory = (oldCat: string, newCat: string) => {
    setCategories((prev) => {
      const next = prev.map((c) => (c === oldCat ? newCat : c));
      try {
        localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    setCurriculum((prev) => {
      const next = prev.map((item) =>
        item.category === oldCat ? { ...item, category: newCat } : item
      );
      try {
        localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleDeleteCategory = (catToDelete: string) => {
    setCategories((prev) => {
      const next = prev.filter((c) => c !== catToDelete);
      try {
        localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    const fallbackCat = categories.find((c) => c !== catToDelete) || 'الكلمة';
    setCurriculum((prev) => {
      const next = prev.map((item) =>
        item.category === catToDelete ? { ...item, category: fallbackCat } : item
      );
      try {
        localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  // Subject Management
  const handleAddSubject = (newSubject: string) => {
    setSubjects((prev) => {
      if (prev.includes(newSubject)) return prev;
      const next = [...prev, newSubject];
      try {
        localStorage.setItem(STORAGE_KEY_SUBJECTS, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleRenameSubject = (oldSubj: string, newSubj: string) => {
    setSubjects((prev) => {
      const next = prev.map((s) => (s === oldSubj ? newSubj : s));
      try {
        localStorage.setItem(STORAGE_KEY_SUBJECTS, JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    setCurriculum((prev) => {
      const next = prev.map((item) =>
        item.lessonSubject === oldSubj ? { ...item, lessonSubject: newSubj } : item
      );
      try {
        localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    if (studentSubject === oldSubj) {
      setStudentSubject(newSubj);
    }
  };

  const handleDeleteSubject = (subjToDelete: string) => {
    setSubjects((prev) => {
      const next = prev.filter((s) => s !== subjToDelete);
      try {
        localStorage.setItem(STORAGE_KEY_SUBJECTS, JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    setCurriculum((prev) => {
      const next = prev.filter((item) => item.lessonSubject !== subjToDelete);
      try {
        localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    const remainingSubjects = subjects.filter((s) => s !== subjToDelete);
    if (remainingSubjects.length > 0) {
      setStudentSubject(remainingSubjects[0]);
    }
  };

  // Add word
  const handleAddWord = (newWord: WordItem) => {
    setCurriculum((prev) => {
      const next = [newWord, ...prev];
      try {
        localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    setSelectedItem(newWord);
    setStudentSubject(newWord.lessonSubject);
    handleAddSubject(newWord.lessonSubject);
  };

  // Update existing word
  const handleUpdateWord = (updatedWord: WordItem) => {
    setCurriculum((prev) => {
      const next = prev.map((item) => (item.id === updatedWord.id ? updatedWord : item));
      try {
        localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    if (selectedItem.id === updatedWord.id) {
      setSelectedItem(updatedWord);
    }
    handleAddSubject(updatedWord.lessonSubject);
  };

  // Delete word
  const handleDeleteWord = (id: string) => {
    setCurriculum((prev) => {
      const next = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    if (selectedItem.id === id) {
      const remaining = curriculum.filter((item) => item.id !== id);
      if (remaining.length > 0) setSelectedItem(remaining[0]);
    }
  };

  // Reset curriculum to default
  const handleResetCurriculum = () => {
    if (confirm('هل أنت متأكد من استعادة المنهج الافتراضي؟')) {
      setCurriculum(ALL_CURRICULUM);
      setCategories(INITIAL_CATEGORIES);
      setSubjects(INITIAL_LESSON_SUBJECTS);
      setSelectedItem(ALL_CURRICULUM[0]);
      setStudentSubject(ALL_CURRICULUM[0].lessonSubject);
      try {
        localStorage.removeItem(STORAGE_KEY_CUSTOM);
        localStorage.removeItem(STORAGE_KEY_CATEGORIES);
        localStorage.removeItem(STORAGE_KEY_SUBJECTS);
      } catch (e) {}
    }
  };

  // Evaluation completed
  const handleEvaluationComplete = async (
    evalResult: PronunciationEvaluation,
    audioUrl?: string,
    studentName?: string
  ) => {
    setEvaluation(evalResult);
    if (audioUrl) setRecordedAudioUrl(audioUrl);

    // Update streak
    if (evalResult.score >= 70) {
      setStreak((prev) => prev + 1);
    } else {
      setStreak(0);
    }

    const currentStudentName = studentName || settings.studentName || 'طالب';

    // Save to history
    saveHistoryItem({
      id: `history-${Date.now()}`,
      wordId: selectedItem.id,
      word: selectedItem.word,
      score: evalResult.score,
      grade: evalResult.grade,
      timestamp: Date.now(),
      spokenText: evalResult.detectedWord,
      recordedAudioUrl: audioUrl,
      studentName: currentStudentName,
      engineUsed: evalResult.engineUsed,
    });

    // Create Submission Record for Admin & Google Sheets
    const submissionRecord: StudentSubmissionRecord = {
      id: `sub-${Date.now()}`,
      studentName: currentStudentName,
      word: selectedItem.word,
      score: evalResult.score,
      grade: evalResult.grade,
      detectedWord: evalResult.detectedWord,
      feedback: evalResult.feedback,
      engineUsed: evalResult.engineUsed,
      timestamp: Date.now(),
      syncedToSheets: false,
    };

    setSubmissions((prev) => {
      const next = [submissionRecord, ...prev].slice(0, 200);
      try {
        localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    // Google Sheets Auto-sync
    if (sheetsConfig.enabled && sheetsConfig.webhookUrl && sheetsConfig.autoSync) {
      try {
        await sendScoreToGoogleSheets(sheetsConfig.webhookUrl, submissionRecord);
        setSubmissions((prev) =>
          prev.map((s) => (s.id === submissionRecord.id ? { ...s, syncedToSheets: true } : s))
        );
      } catch (err) {
        console.warn('Auto sync to Google Sheets error:', err);
      }
    }
  };

  // Distinct subjects
  const allSubjects = Array.from(
    new Set([
      ...subjects,
      ...curriculum.map((c) => c.lessonSubject || 'دروس عامة'),
    ])
  );

  // Words currently available under the student's selected subject
  const currentSubjectWords = curriculum.filter(
    (item) => !studentSubject || item.lessonSubject === studentSubject
  );
  const activeSubjectWords = currentSubjectWords.length > 0 ? currentSubjectWords : curriculum;

  const currentIndex = activeSubjectWords.findIndex((item) => item.id === selectedItem.id);

  const handleSelectWord = (item: WordItem) => {
    setSelectedItem(item);
    setEvaluation(null);
    setRecordedAudioUrl(null);
  };

  const handleNextWord = () => {
    const nextIdx = (currentIndex + 1) % activeSubjectWords.length;
    setSelectedItem(activeSubjectWords[nextIdx]);
    setEvaluation(null);
    setRecordedAudioUrl(null);
  };

  const handlePrevWord = () => {
    const prevIdx = (currentIndex - 1 + activeSubjectWords.length) % activeSubjectWords.length;
    setSelectedItem(activeSubjectWords[prevIdx]);
    setEvaluation(null);
    setRecordedAudioUrl(null);
  };

  const handleClearHistory = () => {
    if (confirm('هل أنت متأكد من مسح سجل التدريب والتقييمات؟')) {
      setHistory([]);
      setScoresMap({});
      setStreak(0);
      try {
        localStorage.removeItem(STORAGE_KEY_HISTORY);
        localStorage.removeItem(STORAGE_KEY_SCORES);
      } catch (e) {}
    }
  };

  const handleClearSubmissions = () => {
    if (confirm('هل أنت متأكد من مسح جميع استجابات ودرجات الطلاب المسجلة؟')) {
      setSubmissions([]);
      try {
        localStorage.removeItem(STORAGE_KEY_SUBMISSIONS);
      } catch (e) {}
    }
  };

  const handleImportCurriculum = (imported: WordItem[]) => {
    setCurriculum(imported);
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(imported));
    } catch (e) {}
    if (imported.length > 0) {
      setSelectedItem(imported[0]);
    }
  };

  // Route to Admin or Student View
  const handleOpenAdmin = () => {
    window.location.hash = 'admin';
    setIsAdminView(true);
  };

  const handleBackToStudent = () => {
    window.location.hash = '';
    setIsAdminView(false);
  };

  // IF ADMIN VIEW IS ACTIVE: Render Revamped Admin Section
  if (isAdminView) {
    return (
      <AdminPanel
        curriculum={curriculum}
        onAddWord={handleAddWord}
        onUpdateWord={handleUpdateWord}
        onDeleteWord={handleDeleteWord}
        sheetsConfig={sheetsConfig}
        onUpdateSheetsConfig={handleUpdateSheetsConfig}
        submissions={submissions}
        onClearSubmissions={handleClearSubmissions}
        onBackToApp={handleBackToStudent}
        defaultEvalMode={settings.preferredEvaluationMode}
        onUpdateDefaultEvalMode={(mode: EvaluationMode) =>
          handleUpdateSettings({ preferredEvaluationMode: mode })
        }
        categories={categories}
        onAddCategory={handleAddCategory}
        onRenameCategory={handleRenameCategory}
        onDeleteCategory={handleDeleteCategory}
        subjects={allSubjects}
        onAddSubject={handleAddSubject}
        onRenameSubject={handleRenameSubject}
        onDeleteSubject={handleDeleteSubject}
        onResetCurriculum={handleResetCurriculum}
        onImportCurriculum={handleImportCurriculum}
      />
    );
  }

  // STANDARD STUDENT PRACTICE VIEW
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-cairo text-slate-800 relative">
      {/* Device Sync Celebratory Notification */}
      {syncNotice && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400 flex items-center gap-2.5 text-xs sm:text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-300">
          <Sparkles className="w-5 h-5 text-emerald-200 shrink-0" />
          <span>{syncNotice}</span>
        </div>
      )}

      {/* Navbar */}
      <Navbar
        streak={streak}
        totalPracticed={history.length}
        onOpenStats={() => setIsStatsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenCustom={handleOpenAdmin}
        onOpenAdmin={handleOpenAdmin}
        isSheetsActive={sheetsConfig.enabled && !!sheetsConfig.webhookUrl}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col">
        {/* Banner */}
        {showWelcomeBanner && (
          <div className="mb-6 p-4 sm:p-5 bg-linear-to-r from-emerald-600 to-teal-700 text-white rounded-3xl shadow-lg shadow-emerald-700/10 flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden">
            <div className="flex items-center gap-3.5 z-10">
              <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 text-emerald-200" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold">
                  فَصِيح: نظام المناهج والدروس المرن + دعم الصور والأصوات
                </h2>
                <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl leading-relaxed">
                  يمكنك إدارة وتعديل وحذف الدروس والفئات من لوحة الإدارة (#admin)، وإرفاق صور وأصوات من Google Drive أو رفع مباشر، والاستماع للصوت بسلاسة.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 z-10 shrink-0">
              <button
                onClick={handleOpenAdmin}
                className="px-4 py-2 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-700" />
                <span>لوحة الإدارة</span>
              </button>
              <button
                onClick={() => setShowWelcomeBanner(false)}
                className="px-3 py-2 text-emerald-200 hover:text-white text-xs cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1">
          {/* Main Practice Arena (Left / 7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6 order-1 lg:order-1">
            {/* Navigation Bar between Words */}
            <div className="flex items-center justify-between px-2">
              <button
                onClick={handlePrevWord}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
                <span>السابق</span>
              </button>

              <div className="text-xs font-bold text-slate-500">
                {selectedItem.word} ({currentIndex + 1} من {activeSubjectWords.length})
              </div>

              <button
                onClick={handleNextWord}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
              >
                <span>التالي</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Practice Card */}
            <PracticeCard
              wordItem={selectedItem}
              settings={settings}
              onEvaluationComplete={handleEvaluationComplete}
              isEvaluating={isEvaluating}
              setIsEvaluating={setIsEvaluating}
              currentIndex={currentIndex}
              totalCount={activeSubjectWords.length}
              onUpdateSettings={handleUpdateSettings}
            />

            {/* Evaluation Results Card */}
            {evaluation && (
              <EvaluationCard
                evaluation={evaluation}
                targetWordItem={selectedItem}
                recordedAudioUrl={recordedAudioUrl}
                onRetry={() => {
                  setEvaluation(null);
                  setRecordedAudioUrl(null);
                }}
                onNext={handleNextWord}
                audioEngine={settings.engine}
              />
            )}
          </div>

          {/* Curriculum & Library Sidebar (Right / 5 cols) */}
          <div className="lg:col-span-5 order-2 lg:order-2 sticky top-20">
            <CurriculumDrawer
              items={curriculum}
              selectedItem={selectedItem}
              onSelectItem={handleSelectWord}
              scoresMap={scoresMap}
              selectedSubject={studentSubject}
              onSelectSubject={setStudentSubject}
              subjectsList={allSubjects}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 mt-12 text-center text-xs text-slate-400">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">فَصِيح</span>
            <span>—</span>
            <span>نظام إدارة الدروس والكلمات وتقييم النطق العربي</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <button
              onClick={handleOpenAdmin}
              className="text-emerald-700 font-bold hover:underline cursor-pointer"
            >
              رابط لوحة الإدارة (#admin)
            </button>
            <span>•</span>
            <span>يدعم Google Drive و Dropbox و GitHub و Vercel</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <StatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        history={history}
        onClearHistory={handleClearHistory}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      <GuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
