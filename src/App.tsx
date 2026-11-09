import React, { useState, useEffect } from 'react';
import {
  WordItem,
  PronunciationEvaluation,
  PracticeHistoryItem,
  AudioSettings,
  GoogleSheetsConfig,
  StudentSubmissionRecord,
  EvaluationMode,
  StudentRegistrant,
  HomeBrandConfig,
} from './types';
import {
  ALL_CURRICULUM,
  INITIAL_CATEGORIES,
  INITIAL_LESSON_SUBJECTS,
} from './data/arabicCurriculum';
import { Navbar } from './components/Navbar';
import { PracticeCard } from './components/PracticeCard';
import { EvaluationCard } from './components/EvaluationCard';
import { StatsModal } from './components/StatsModal';
import { SettingsModal } from './components/SettingsModal';
import { GuideModal } from './components/GuideModal';
import { AdminPanel } from './components/AdminPanel';
import { LessonsModal } from './components/LessonsModal';
import { StudentLoginModal } from './components/StudentLoginModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { SocialIcon, getSocialBrandClasses } from './components/SocialIcon';
import {
  sendScoreToGoogleSheets,
  fetchCurriculumFromSheets,
  fetchHomeConfigFromSheets,
  fetchStudentSubmissionsFromSheet,
  fetchTranslationsFromSheets,
  saveTranslationsToSheets,
  DEFAULT_WEBHOOK_URL,
  DEFAULT_DRIVE_AUDIO_FOLDER_ID,
  STUDENT_AUDIO_DRIVE_FOLDER_ID,
} from './utils/googleSheets';
import {
  SupportedLang,
  TranslationItem,
  getStoredLanguage,
  setStoredLanguage,
  getStoredTranslations,
  saveStoredTranslations,
  getTranslatedString,
} from './utils/translations';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Sliders,
  BookOpen,
  Play,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Headphones,
  Zap,
  RotateCcw,
  Home,
  Layers,
  Award,
} from 'lucide-react';

const STORAGE_KEY_HISTORY = 'faseeh_pronunciation_history_v1';
const STORAGE_KEY_SCORES = 'faseeh_pronunciation_scores_v1';
const STORAGE_KEY_CUSTOM = 'faseeh_custom_words_v2';
const STORAGE_KEY_SETTINGS = 'faseeh_audio_settings_v1';
const STORAGE_KEY_SHEETS = 'faseeh_sheets_config_v1';
const STORAGE_KEY_SUBMISSIONS = 'faseeh_submissions_v1';
const STORAGE_KEY_CATEGORIES = 'faseeh_categories_v2';
const STORAGE_KEY_SUBJECTS = 'faseeh_subjects_v2';
const STORAGE_KEY_STUDENT = 'faseeh_active_student_v1';

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

  // Separate Admin View routing (supports URL: #control / #admin)
  const [isAdminView, setIsAdminView] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('faseeh_admin_auth') === 'true';
    } catch {
      return false;
    }
  });
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);

  // Student View: Active Lesson Subject
  const [studentSubject, setStudentSubject] = useState<string>(
    ALL_CURRICULUM[0]?.lessonSubject || INITIAL_LESSON_SUBJECTS[0]
  );

  // Main UI Mode: 'landing' (الرئيسية التعريفية) or 'practice' (صفحة التدريب والتسجيل)
  const [currentView, setCurrentView] = useState<'landing' | 'practice'>('landing');
  const [isLessonsModalOpen, setIsLessonsModalOpen] = useState(false);

  // Modals & Registration
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<StudentRegistrant | null>(null);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(true);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Home Page Branding & Dynamic Social Media Links (Sheet: "الرئيسية")
  const [homeConfig, setHomeConfig] = useState<HomeBrandConfig | null>(() => {
    try {
      const cached = localStorage.getItem('faseeh_cached_home_config');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  // Dedicated Student Evaluation History (from sheet "answers 1")
  const [studentHistory, setStudentHistory] = useState<PracticeHistoryItem[]>([]);
  const [isSyncingAnswers1, setIsSyncingAnswers1] = useState(false);

  // Scores map: wordId -> score
  const [scoresMap, setScoresMap] = useState<Record<string, number>>({});
  // Practice History
  const [history, setHistory] = useState<PracticeHistoryItem[]>([]);

  // Submission status for current exercise
  const [isCurrentAnswerSubmitted, setIsCurrentAnswerSubmitted] = useState(false);

  // Google Sheets Config (Defaulted to verified Webhook URL for seamless cross-device sync)
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig>({
    enabled: true,
    webhookUrl: DEFAULT_WEBHOOK_URL,
    autoSync: true,
    syncCurriculumFromSheets: true,
    teacherDriveFolderId: DEFAULT_DRIVE_AUDIO_FOLDER_ID,
    studentDriveFolderId: STUDENT_AUDIO_DRIVE_FOLDER_ID,
    driveFolderId: DEFAULT_DRIVE_AUDIO_FOLDER_ID,
  });

  // Student Submissions Log
  const [submissions, setSubmissions] = useState<StudentSubmissionRecord[]>([]);

  // Translations & Language State (Supported: 'ar' | 'th' | 'en')
  const [currentLang, setCurrentLang] = useState<SupportedLang>(getStoredLanguage);
  const [translations, setTranslations] = useState<TranslationItem[]>(getStoredTranslations);

  const t = (id: string, fallbackAr?: string): string => {
    return getTranslatedString(id, currentLang, translations, fallbackAr);
  };

  const handleSelectLang = (lang: SupportedLang) => {
    setCurrentLang(lang);
    setStoredLanguage(lang);
  };

  const handleUpdateTranslations = async (items: TranslationItem[]) => {
    setTranslations(items);
    saveStoredTranslations(items);

    // Sync any sheet "الرئيسية" Arabic edits into homeConfig immediately (allowing clean empty strings)
    const titleItem = items.find((i) => i.id === 'nav_platform_title');
    const subtitleItem = items.find((i) => i.id === 'nav_platform_subtitle');
    const cardTitleItem = items.find((i) => i.id === 'home_card_title');
    const cardSubtitleItem = items.find((i) => i.id === 'home_card_subtitle');
    const extra1Item = items.find((i) => i.id === 'home_card_extra1');
    const extra2Item = items.find((i) => i.id === 'home_card_extra2');
    const extra3Item = items.find((i) => i.id === 'home_card_extra3');

    setHomeConfig((prev) => {
      const updated: HomeBrandConfig = {
        title: titleItem !== undefined ? titleItem.ar : (prev?.title || ''),
        subtitle: subtitleItem !== undefined ? subtitleItem.ar : (prev?.subtitle || ''),
        logoUrl: prev?.logoUrl || '',
        card: {
          cardLogoUrl: prev?.card?.cardLogoUrl || '',
          cardBgUrl: prev?.card?.cardBgUrl || '',
          cardTitle: cardTitleItem !== undefined ? cardTitleItem.ar : (prev?.card?.cardTitle || ''),
          cardSubtitle: cardSubtitleItem !== undefined ? cardSubtitleItem.ar : (prev?.card?.cardSubtitle || ''),
          extraText1: extra1Item !== undefined ? extra1Item.ar : prev?.card?.extraText1,
          extraText2: extra2Item !== undefined ? extra2Item.ar : prev?.card?.extraText2,
          extraText3: extra3Item !== undefined ? extra3Item.ar : prev?.card?.extraText3,
        },
        socialLinks: prev?.socialLinks || [],
        adminUsers: prev?.adminUsers || [],
      };
      try {
        localStorage.setItem('faseeh_cached_home_config', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Sync any curriculum meaning/makhraj updates (Columns 6 & 7)
    setCurriculum((prev) => {
      let changed = false;
      const next = prev.map((w) => {
        const meaningItem = items.find((i) => i.id === `lesson_${w.word}_meaning`);
        const makhrajItem = items.find((i) => i.id === `lesson_${w.word}_makhraj`);
        const newMeaning = meaningItem && meaningItem.ar !== undefined ? meaningItem.ar : w.meaning;
        const newMakhraj = makhrajItem && makhrajItem.ar !== undefined ? makhrajItem.ar : w.makhrajTip;
        if (newMeaning !== w.meaning || newMakhraj !== w.makhrajTip) {
          changed = true;
          return { ...w, meaning: newMeaning, makhrajTip: newMakhraj };
        }
        return w;
      });
      if (changed) {
        try {
          localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(next));
        } catch {}
      }
      return changed ? next : prev;
    });

    if (sheetsConfig.webhookUrl) {
      try {
        await saveTranslationsToSheets(sheetsConfig.webhookUrl, items);
      } catch (err) {
        console.warn('Error saving translations to Google Sheets:', err);
      }
    }
  };

  // Full Refresh / Pull all latest data from Google Sheets into the Platform
  const handleRefreshAllFromSheets = async (): Promise<void> => {
    const url = sheetsConfig.webhookUrl;
    if (!url) {
      alert('يرجى التأكد من إدخال رابط Google Sheets Webhook أولاً في الإعدادات.');
      return;
    }

    const [currRes, homeCfg, transRes] = await Promise.all([
      fetchCurriculumFromSheets(url),
      fetchHomeConfigFromSheets(url),
      fetchTranslationsFromSheets(url),
    ]);

    // 1. Update curriculum from sheet "الدروس"
    if (currRes.success && currRes.curriculum && currRes.curriculum.length > 0) {
      setCurriculum(currRes.curriculum);
      if (currRes.subjects && currRes.subjects.length > 0) {
        setSubjects(currRes.subjects);
        localStorage.setItem(STORAGE_KEY_SUBJECTS, JSON.stringify(currRes.subjects));
      }
      if (currRes.categories && currRes.categories.length > 0) {
        setCategories(currRes.categories);
        localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(currRes.categories));
      }
      localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(currRes.curriculum));
    }

    // 2. Update homeConfig from sheet "الرئيسية"
    if (homeCfg) {
      setHomeConfig(homeCfg);
      localStorage.setItem('faseeh_cached_home_config', JSON.stringify(homeCfg));
    }

    // 3. Update translations from sheet "الترجمة"
    if (transRes && Array.isArray(transRes) && transRes.length > 0) {
      setTranslations((prev) => {
        const map = new Map<string, TranslationItem>();
        prev.forEach((p) => map.set(p.id, p));
        transRes.forEach((t: any) => {
          const ex = map.get(t.id);
          if (ex) {
            map.set(t.id, {
              ...ex,
              ar: t.ar !== undefined ? t.ar : ex.ar,
              th: t.th !== undefined ? t.th : ex.th,
              en: t.en !== undefined ? t.en : ex.en,
            });
          } else if (t.id) {
            map.set(t.id, t as TranslationItem);
          }
        });
        const merged = Array.from(map.values());
        saveStoredTranslations(merged);
        return merged;
      });
    }
  };

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

      const isControlRoute =
        hash.toLowerCase() === '#control' ||
        path === '/control' ||
        hash.toLowerCase() === '#admin' ||
        path === '/admin';

      if (isControlRoute) {
        const authed = sessionStorage.getItem('faseeh_admin_auth') === 'true';
        if (authed) {
          setIsAdminView(true);
        } else {
          setIsAdminView(false);
          setShowAdminLoginModal(true);
        }
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
        // Strict isolation: default to 'whisper', reset legacy 'acoustic'/'ai' cached values
        const cleanMode: EvaluationMode =
          parsed.preferredEvaluationMode === 'local' ? 'local' : 'whisper';
        setSettings({
          ...parsed,
          preferredEvaluationMode: cleanMode,
        });
      }

      const savedSheets = localStorage.getItem(STORAGE_KEY_SHEETS);
      let activeConfig: GoogleSheetsConfig = {
        enabled: true,
        webhookUrl: DEFAULT_WEBHOOK_URL,
        autoSync: true,
        syncCurriculumFromSheets: true,
        teacherDriveFolderId: DEFAULT_DRIVE_AUDIO_FOLDER_ID,
        studentDriveFolderId: STUDENT_AUDIO_DRIVE_FOLDER_ID,
        driveFolderId: DEFAULT_DRIVE_AUDIO_FOLDER_ID,
      };

      if (savedSheets) {
        try {
          const parsedSheets: GoogleSheetsConfig = JSON.parse(savedSheets);
          const teacherId =
            parsedSheets.teacherDriveFolderId || parsedSheets.driveFolderId || DEFAULT_DRIVE_AUDIO_FOLDER_ID;
          const studentId = parsedSheets.studentDriveFolderId || STUDENT_AUDIO_DRIVE_FOLDER_ID;
          const sanitizedWebhook =
            !parsedSheets.webhookUrl || parsedSheets.webhookUrl.includes('AKfycbyqkLw2qbPSAEzXgaq')
              ? DEFAULT_WEBHOOK_URL
              : parsedSheets.webhookUrl;

          activeConfig = {
            ...activeConfig,
            ...parsedSheets,
            webhookUrl: sanitizedWebhook,
            teacherDriveFolderId: teacherId,
            studentDriveFolderId: studentId,
            driveFolderId: teacherId,
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

              // Silent sync: removed top toast as requested by the user
              // Fetch Home tab configuration (branding & dynamic social media channels)
              fetchHomeConfigFromSheets(activeConfig.webhookUrl)
                .then((cfg) => {
                  if (cfg) {
                    setHomeConfig(cfg);

                    // Sync sheet "الرئيسية" Arabic source texts into translations dictionary
                    setTranslations((prev) => {
                      return prev.map((item) => {
                        if (item.id === 'nav_platform_title' && cfg.title !== undefined) {
                          return { ...item, ar: cfg.title };
                        }
                        if (item.id === 'nav_platform_subtitle' && cfg.subtitle !== undefined) {
                          return { ...item, ar: cfg.subtitle };
                        }
                        if (item.id === 'home_card_title' && cfg.card?.cardTitle !== undefined) {
                          return { ...item, ar: cfg.card.cardTitle };
                        }
                        if (item.id === 'home_card_subtitle' && cfg.card?.cardSubtitle !== undefined) {
                          return { ...item, ar: cfg.card.cardSubtitle };
                        }
                        if (item.id === 'home_card_extra1' && cfg.card?.extraText1 !== undefined) {
                          return { ...item, ar: cfg.card.extraText1 };
                        }
                        if (item.id === 'home_card_extra2' && cfg.card?.extraText2 !== undefined) {
                          return { ...item, ar: cfg.card.extraText2 };
                        }
                        if (item.id === 'home_card_extra3' && cfg.card?.extraText3 !== undefined) {
                          return { ...item, ar: cfg.card.extraText3 };
                        }
                        return item;
                      });
                    });

                    if (sessionStorage.getItem('faseeh_admin_auth') === 'true') {
                      const currentAdminName = sessionStorage.getItem('faseeh_admin_name') || '';
                      if (cfg.adminUsers && cfg.adminUsers.length > 0) {
                        const blockedRecord = cfg.adminUsers.find(
                          (u) =>
                            (u.name.toLowerCase() === currentAdminName.toLowerCase() ||
                              currentAdminName.includes(u.name)) &&
                            u.blocked
                        );
                        if (blockedRecord) {
                          handleAdminLogout();
                          alert('يوجد خطا في التسجيل .. يرجى التواصل مع الادارة');
                        }
                      }
                    }
                  }
                })
                .catch(() => {});
            }
          })
          .catch((err) => {
            console.warn('Auto-sync from Google Sheets on startup notice:', err);
          });
      }

      // Auto-fetch translations from sheet "الترجمة"
      if (activeConfig.webhookUrl) {
        fetchTranslationsFromSheets(activeConfig.webhookUrl)
          .then((fetched) => {
            if (fetched && Array.isArray(fetched) && fetched.length > 0) {
              setTranslations((prev) => {
                const map = new Map<string, TranslationItem>();
                prev.forEach((p) => map.set(p.id, p));
                fetched.forEach((t: any) => {
                  const ex = map.get(t.id);
                  if (ex) {
                    map.set(t.id, {
                      ...ex,
                      ar: t.ar !== undefined ? t.ar : ex.ar,
                      th: t.th !== undefined ? t.th : ex.th,
                      en: t.en !== undefined ? t.en : ex.en,
                    });
                  } else if (t.id) {
                    map.set(t.id, {
                      id: t.id,
                      category: t.category || 'home',
                      categoryLabel: t.categoryLabel || '',
                      ar: t.ar !== undefined ? t.ar : '',
                      th: t.th !== undefined ? t.th : '',
                      en: t.en !== undefined ? t.en : '',
                    });
                  }
                });
                const merged = Array.from(map.values());
                saveStoredTranslations(merged);
                return merged;
              });
            }
          })
          .catch((err) => {
            console.warn('Auto-fetch translations notice:', err);
          });
      }

      const savedSubmissions = localStorage.getItem(STORAGE_KEY_SUBMISSIONS);
      if (savedSubmissions) setSubmissions(JSON.parse(savedSubmissions));

      const savedStudent = localStorage.getItem(STORAGE_KEY_STUDENT);
      if (savedStudent) {
        try {
          const parsed = JSON.parse(savedStudent);
          setCurrentStudent(parsed);
          if (parsed?.name) {
            setSettings((prev) => ({ ...prev, studentName: parsed.name }));
          }
          if (parsed?.id && parsed?.name && activeConfig.webhookUrl) {
            fetchStudentSubmissionsFromSheet(activeConfig.webhookUrl, parsed.id, parsed.name)
              .then((sh) => {
                if (sh && sh.length > 0) setStudentHistory(sh);
              })
              .catch(() => {});
          }
        } catch (e) {}
      }
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

  const handleLoginSuccess = (student: StudentRegistrant) => {
    setCurrentStudent(student);
    try {
      localStorage.setItem(STORAGE_KEY_STUDENT, JSON.stringify(student));
    } catch (e) {}
    setSettings((prev) => ({ ...prev, studentName: student.name }));
    if (student?.id && student?.name && sheetsConfig.webhookUrl) {
      setIsSyncingAnswers1(true);
      fetchStudentSubmissionsFromSheet(sheetsConfig.webhookUrl, student.id, student.name)
        .then((sh) => {
          if (sh && sh.length > 0) setStudentHistory(sh);
        })
        .catch(() => {})
        .finally(() => setIsSyncingAnswers1(false));
    }
  };

  const handleLogout = () => {
    setCurrentStudent(null);
    setStudentHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY_STUDENT);
    } catch (e) {}
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

    const currentStudentName = currentStudent?.name || studentName || settings.studentName || 'طالب';

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
    if (item.lessonSubject) {
      setStudentSubject(item.lessonSubject);
    }
    setEvaluation(null);
    setRecordedAudioUrl(null);
    setIsCurrentAnswerSubmitted(false);
    setCurrentView('practice');
    setIsLessonsModalOpen(false);
  };

  const handleNextWord = () => {
    const nextIdx = (currentIndex + 1) % activeSubjectWords.length;
    setSelectedItem(activeSubjectWords[nextIdx]);
    setEvaluation(null);
    setRecordedAudioUrl(null);
    setIsCurrentAnswerSubmitted(false);
  };

  const handlePrevWord = () => {
    const prevIdx = (currentIndex - 1 + activeSubjectWords.length) % activeSubjectWords.length;
    setSelectedItem(activeSubjectWords[prevIdx]);
    setEvaluation(null);
    setRecordedAudioUrl(null);
    setIsCurrentAnswerSubmitted(false);
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

  // Route to Admin or Student View with Authentication
  const handleOpenAdmin = () => {
    if (isAdminAuthenticated) {
      window.location.hash = 'control';
      setIsAdminView(true);
    } else {
      setShowAdminLoginModal(true);
    }
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    try {
      sessionStorage.setItem('faseeh_admin_auth', 'true');
    } catch {}
    setShowAdminLoginModal(false);
    window.location.hash = 'control';
    setIsAdminView(true);
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    try {
      sessionStorage.removeItem('faseeh_admin_auth');
    } catch {}
    setIsAdminView(false);
    window.location.hash = '';
  };

  const handleBackToStudent = () => {
    window.location.hash = '';
    setIsAdminView(false);
  };

  // IF ADMIN VIEW IS ACTIVE: Render Revamped Admin Section
  if (isAdminView) {
    return (
      <>
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
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenGuide={() => setIsGuideOpen(true)}
          onLogout={handleAdminLogout}
          translations={translations}
          onUpdateTranslations={handleUpdateTranslations}
          geminiApiKey={settings.geminiApiKey}
          onRefreshFromSheets={handleRefreshAllFromSheets}
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
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          defaultEvalMode={settings.preferredEvaluationMode}
          onUpdateDefaultEvalMode={(mode) => handleUpdateSettings({ preferredEvaluationMode: mode })}
        />
      </>
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
        totalPracticed={currentStudent ? (studentHistory.length || history.length) : history.length}
        onOpenStats={() => {
          if (currentStudent && sheetsConfig.webhookUrl) {
            setIsSyncingAnswers1(true);
            fetchStudentSubmissionsFromSheet(sheetsConfig.webhookUrl, currentStudent.id, currentStudent.name)
              .then((sh) => {
                if (sh && sh.length > 0) setStudentHistory(sh);
              })
              .catch(() => {})
              .finally(() => setIsSyncingAnswers1(false));
          }
          setIsStatsOpen(true);
        }}
        onOpenCustom={handleOpenAdmin}
        onOpenAdmin={handleOpenAdmin}
        isAdminAuthenticated={isAdminAuthenticated}
        onAdminLogout={handleAdminLogout}
        isSheetsActive={sheetsConfig.enabled && !!sheetsConfig.webhookUrl}
        onOpenLessons={() => setIsLessonsModalOpen(true)}
        onGoHome={() => setCurrentView('landing')}
        currentView={currentView}
        currentStudent={currentStudent}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        customLogoUrl={homeConfig?.logoUrl}
        customTitle={currentLang === 'ar' ? homeConfig?.title : t('nav_platform_title', homeConfig?.title)}
        currentLang={currentLang}
        onSelectLang={handleSelectLang}
        t={t}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col">
        {currentView === 'landing' ? (
          /* ========================================================
             1. INTRODUCTORY LANDING PAGE (الصفحة الرئيسية التعريفية)
             ======================================================== */
          <div className="flex flex-col items-center justify-center animate-in fade-in duration-300 py-2 sm:py-6">
            {/* Main Hero Card - Controlled exclusively by sheet 'الرئيسية' B21:B27 */}
            <div
              className="relative overflow-hidden rounded-3xl text-white shadow-2xl border border-slate-800/80 max-w-4xl w-full mx-auto"
              style={
                homeConfig?.card?.cardBgUrl
                  ? {
                      backgroundImage: `url(${homeConfig.card.cardBgUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }
                  : undefined
              }
            >
              {/* Dark overlay for contrast and crystal-clear readability (supports static images & animated GIFs) */}
              <div className="absolute inset-0 bg-linear-to-b from-slate-950/90 via-slate-950/85 to-slate-950/92 backdrop-blur-xs" />
              <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center text-center p-7 sm:p-14 max-w-3xl mx-auto">
                {/* 1. B21: Card Logo (Centered) */}
                {homeConfig?.card?.cardLogoUrl && (
                  <div className="mb-6 flex justify-center">
                    <img
                      src={homeConfig.card.cardLogoUrl}
                      alt="شعار البطاقة"
                      className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl object-contain shadow-2xl border-2 border-white/20 bg-white/10 p-2 backdrop-blur-xs"
                      onError={(e) => {
                        (e.target as any).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* 2. B23: Card Main Title */}
                {(() => {
                  const rawFallback = homeConfig?.card?.cardTitle !== undefined ? homeConfig.card.cardTitle : (homeConfig?.title !== undefined ? homeConfig.title : '');
                  const cardTitleVal = t('home_card_title', rawFallback);
                  return cardTitleVal ? (
                    <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight font-amiri leading-tight sm:leading-snug mb-4 text-white">
                      {cardTitleVal}
                    </h1>
                  ) : null;
                })()}

                {/* 3. B24: Card Subtitle / Description */}
                {(() => {
                  const rawSubFallback = homeConfig?.card?.cardSubtitle !== undefined ? homeConfig.card.cardSubtitle : (homeConfig?.subtitle !== undefined ? homeConfig.subtitle : '');
                  const cardSubVal = t('home_card_subtitle', rawSubFallback);
                  return cardSubVal ? (
                    <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl mx-auto mb-6">
                      {cardSubVal}
                    </p>
                  ) : null;
                })()}

                {/* 4. B25:B27: Optional Extra Texts */}
                {(() => {
                  const ex1 = t('home_card_extra1', homeConfig?.card?.extraText1 || '');
                  const ex2 = t('home_card_extra2', homeConfig?.card?.extraText2 || '');
                  const ex3 = t('home_card_extra3', homeConfig?.card?.extraText3 || '');
                  if (!ex1 && !ex2 && !ex3) return null;
                  return (
                    <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-2xl mx-auto mb-8">
                      {Boolean(ex1) && (
                        <span className="px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 backdrop-blur-xs">
                          {ex1}
                        </span>
                      )}
                      {Boolean(ex2) && (
                        <span className="px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-sky-500/20 text-sky-200 border border-sky-400/30 backdrop-blur-xs">
                          {ex2}
                        </span>
                      )}
                      {Boolean(ex3) && (
                        <span className="px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 backdrop-blur-xs">
                          {ex3}
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* 5. ONLY ONE ACTION BUTTON: [ فتح الدروس والتمارين 📚 ] */}
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => setIsLessonsModalOpen(true)}
                    className="flex items-center justify-center gap-2.5 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-2xl text-base sm:text-lg transition-all shadow-xl shadow-emerald-500/30 cursor-pointer hover:scale-105 active:scale-95"
                  >
                    <BookOpen className="w-5 h-5" />
                    <span>{t('nav_open_lessons', 'فتح الدروس والتمارين 📚')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================
             2. PRACTICE & RECORDING ARENA (صفحة الدرس والتسجيل)
             ======================================================== */
          <div className="flex flex-col gap-6 animate-in fade-in duration-300">
            {/* Top Navigation & Fast Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentView('landing')}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer shadow-2xs"
                  title={currentLang === 'ar' ? 'الصفحة الرئيسية' : currentLang === 'th' ? 'หน้าหลัก' : 'Home'}
                >
                  <Home className="w-4 h-4 text-slate-700" />
                </button>

                <button
                  onClick={() => setIsLessonsModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200/80 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  title={t('nav_open_lessons', 'فتح قائمة الدروس واختيار تمرين آخر')}
                >
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  <span>({t('nav_open_lessons', 'فتح الدروس')})</span>
                </button>
              </div>

              {/* Lesson Metadata Badge: الموضوع | الفئة | عدد الدروس في الموضوع */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-900 font-bold border border-emerald-200/80 flex items-center gap-1">
                  <span className="text-emerald-700 font-normal">
                    {currentLang === 'ar' ? 'الموضوع:' : currentLang === 'th' ? 'หัวข้อ:' : 'Subject:'}
                  </span>
                  <span>{selectedItem.lessonSubject || studentSubject}</span>
                </span>
                {selectedItem.category && (
                  <span className="px-2.5 py-1 rounded-xl bg-sky-50 text-sky-900 font-bold border border-sky-200/80 flex items-center gap-1">
                    <span className="text-sky-700 font-normal">
                      {currentLang === 'ar' ? 'الفئة:' : currentLang === 'th' ? 'หมวดหมู่:' : 'Category:'}
                    </span>
                    <span>
                      {selectedItem.category === 'الحرف'
                        ? t('category_letter', 'الحرف')
                        : selectedItem.category === 'الكلمة'
                        ? t('category_word', 'الكلمة')
                        : selectedItem.category === 'الجملة'
                        ? t('category_sentence', 'الجملة')
                        : selectedItem.category}
                    </span>
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 font-bold border border-slate-200 flex items-center gap-1">
                  <span>
                    {currentLang === 'ar'
                      ? `التمرين ${currentIndex + 1} من ${activeSubjectWords.length}`
                      : currentLang === 'th'
                      ? `แบบฝึกหัดที่ ${currentIndex + 1} จาก ${activeSubjectWords.length}`
                      : `Exercise ${currentIndex + 1} of ${activeSubjectWords.length}`}
                  </span>
                </span>
              </div>
            </div>

            {/* Main Practice Arena - Centered Clean Layout */}
            <div className="max-w-2xl mx-auto w-full flex flex-col gap-6">
              {/* Practice Card */}
              <PracticeCard
                wordItem={selectedItem}
                settings={settings}
                currentStudent={currentStudent}
                onEvaluationComplete={handleEvaluationComplete}
                isEvaluating={isEvaluating}
                setIsEvaluating={setIsEvaluating}
                currentIndex={currentIndex}
                totalCount={activeSubjectWords.length}
                onUpdateSettings={handleUpdateSettings}
                onOpenLessons={() => setIsLessonsModalOpen(true)}
                isSubmitted={isCurrentAnswerSubmitted}
                onReRecord={() => {
                  setIsCurrentAnswerSubmitted(false);
                  setEvaluation(null);
                  setRecordedAudioUrl(null);
                }}
                t={t}
              />

              {/* Evaluation Results Card */}
              {evaluation && (
                <EvaluationCard
                  evaluation={evaluation}
                  targetWordItem={selectedItem}
                  recordedAudioUrl={recordedAudioUrl}
                  onRetry={() => {
                    setIsCurrentAnswerSubmitted(false);
                    setEvaluation(null);
                    setRecordedAudioUrl(null);
                  }}
                  onNext={handleNextWord}
                  onOpenLessons={() => setIsLessonsModalOpen(true)}
                  audioEngine={settings.engine}
                  currentStudent={currentStudent}
                  webhookUrl={sheetsConfig.webhookUrl}
                  driveFolderId={sheetsConfig.teacherDriveFolderId || sheetsConfig.driveFolderId}
                  studentDriveFolderId={sheetsConfig.studentDriveFolderId || STUDENT_AUDIO_DRIVE_FOLDER_ID}
                  lessonSubject={selectedItem.lessonSubject || studentSubject}
                  wordIndex={currentIndex}
                  onRequestLogin={() => setIsLoginModalOpen(true)}
                  onSubmissionSuccess={() => setIsCurrentAnswerSubmitted(true)}
                  currentLang={currentLang}
                  translations={translations}
                  t={t}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer: Dynamic Social Media Channels from sheet "الرئيسية" with NO text */}
      <footer className="border-t border-slate-200/80 bg-white py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-center gap-3">
          {homeConfig?.socialLinks && homeConfig.socialLinks.length > 0 ? (
            homeConfig.socialLinks
              .filter((link) => link.url && link.iconKey)
              .map((link, idx) => {
                const brand = getSocialBrandClasses(link.iconKey);
                return (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all duration-200 shadow-2xs hover:scale-110 active:scale-95 cursor-pointer ${brand.bg} ${brand.text} ${brand.border} ${brand.hover}`}
                    title={link.iconKey}
                  >
                    <SocialIcon iconKey={link.iconKey} className="w-5 h-5" />
                  </a>
                );
              })
          ) : (
            /* Sample Social Icons ready for user links (Line, Facebook, Instagram, YouTube) */
            <div className="flex flex-wrap items-center justify-center gap-3">
              {[
                { key: 'line', label: 'Line' },
                { key: 'facebook', label: 'Facebook' },
                { key: 'instagram', label: 'Instagram' },
                { key: 'youtube', label: 'YouTube' },
              ].map((item) => {
                const brand = getSocialBrandClasses(item.key);
                return (
                  <div
                    key={item.key}
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center border opacity-60 ${brand.bg} ${brand.text} ${brand.border}`}
                    title={`${item.label} (في انتظار إدخال الرابط في ورقة الرئيسية)`}
                  >
                    <SocialIcon iconKey={item.key} className="w-5 h-5" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </footer>

      {/* Modals */}
      <StatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        history={currentStudent ? studentHistory : history}
        onClearHistory={handleClearHistory}
        currentStudent={currentStudent}
        isSyncingFromSheets={isSyncingAnswers1}
        currentLang={currentLang}
        translations={translations}
        t={t}
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
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        defaultEvalMode={settings.preferredEvaluationMode}
        onUpdateDefaultEvalMode={(mode) => handleUpdateSettings({ preferredEvaluationMode: mode })}
      />

      {/* Lessons Selector Modal */}
      <LessonsModal
        isOpen={isLessonsModalOpen}
        onClose={() => setIsLessonsModalOpen(false)}
        curriculum={curriculum}
        selectedItem={selectedItem}
        onSelectItem={handleSelectWord}
        subjectsList={allSubjects}
        selectedSubject={studentSubject}
        onSelectSubject={setStudentSubject}
        scoresMap={scoresMap}
        t={t}
      />

      {/* Student Login & Registration Verification Modal */}
      <StudentLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        webhookUrl={sheetsConfig.webhookUrl}
        t={t}
      />

      {/* Admin Login Verification Modal */}
      <AdminLoginModal
        isOpen={showAdminLoginModal}
        onClose={() => setShowAdminLoginModal(false)}
        onLoginSuccess={handleAdminLoginSuccess}
        adminUsers={homeConfig?.adminUsers}
      />
    </div>
  );
}
