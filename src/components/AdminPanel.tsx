import React, { useState, useRef } from 'react';
import {
  WordItem,
  GoogleSheetsConfig,
  StudentSubmissionRecord,
  EvaluationMode,
  DifficultyLevel,
  Answers1SubmissionRow,
} from '../types';
import {
  ALL_CURRICULUM,
  INITIAL_LESSON_SUBJECTS,
  INITIAL_CATEGORIES,
} from '../data/arabicCurriculum';
import QRCode from 'qrcode';
import {
  BookOpen,
  Plus,
  Trash2,
  Table,
  Sparkles,
  Link2,
  CheckCircle2,
  Download,
  Upload,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  Search,
  Filter,
  Volume2,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Send,
  Sliders,
  Edit3,
  Image as ImageIcon,
  Play,
  RotateCcw,
  Layers,
  FolderPlus,
  Mic,
  MicOff,
  Settings2,
  X,
  Info,
  Save,
  FileCode,
  Terminal,
  CheckCheck,
  Globe,
  Cpu,
  QrCode,
  Smartphone,
  Loader2,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Gauge,
  Clock,
  Settings,
  LogOut,
  Languages,
} from 'lucide-react';
import { TranslationItem } from '../utils/translations';
import { TranslationManager } from './TranslationManager';
import {
  getDailyQuotaStatus,
  resetDailyQuota,
  setDailyMaxQuota,
  QuotaStatus,
} from '../utils/aiQuota';
import { removeTashkeel } from '../utils/arabicMatcher';
import {
  sendScoreToGoogleSheets,
  exportRecordsToCSV,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  fetchCurriculumFromSheets,
  saveWordToGoogleSheets,
  deleteWordFromGoogleSheets,
  syncAllCurriculumToSheets,
  uploadAudioToDrive,
  DEFAULT_WEBHOOK_URL,
  DEFAULT_DRIVE_AUDIO_FOLDER_ID,
  STUDENT_AUDIO_DRIVE_FOLDER_ID,
  fetchAllSubmissionsFromSheet,
} from '../utils/googleSheets';
import { speakArabicBrowser, playUniversalArabicStream, playCustomAudio, stopAllAudio, blobToBase64 } from '../utils/arabicAudio';
import { normalizeMediaUrl, getDirectImageUrl, getDirectAudioUrl } from '../utils/mediaUrl';

interface AdminPanelProps {
  curriculum: WordItem[];
  onAddWord: (word: WordItem) => void;
  onUpdateWord: (word: WordItem) => void;
  onDeleteWord: (id: string) => void;
  sheetsConfig: GoogleSheetsConfig;
  onUpdateSheetsConfig: (config: Partial<GoogleSheetsConfig>) => void;
  submissions: StudentSubmissionRecord[];
  onClearSubmissions: () => void;
  onBackToApp: () => void;
  defaultEvalMode: EvaluationMode;
  onUpdateDefaultEvalMode: (mode: EvaluationMode) => void;
  categories: string[];
  onAddCategory: (newCategory: string) => void;
  onRenameCategory: (oldCat: string, newCat: string) => void;
  onDeleteCategory: (cat: string) => void;
  subjects: string[];
  onAddSubject: (newSubject: string) => void;
  onRenameSubject: (oldSubj: string, newSubj: string) => void;
  onDeleteSubject: (subj: string) => void;
  onResetCurriculum: () => void;
  onImportCurriculum: (imported: WordItem[]) => void;
  onOpenSettings?: () => void;
  onOpenGuide?: () => void;
  onLogout?: () => void;
  translations?: TranslationItem[];
  onUpdateTranslations?: (items: TranslationItem[]) => void;
  geminiApiKey?: string;
  onRefreshFromSheets?: () => Promise<void>;
}

const TASHKEEL_BUTTONS = [
  { char: '\u064E', label: 'ـَ', name: 'فتحة' },
  { char: '\u064F', label: 'ـُ', name: 'ضمة' },
  { char: '\u0650', label: 'ـِ', name: 'كسرة' },
  { char: '\u0652', label: 'ـْ', name: 'سكون' },
  { char: '\u0651', label: 'ـّ', name: 'شدة' },
  { char: '\u064B', label: 'ـً', name: 'تنوين فتح' },
  { char: '\u064C', label: 'ـٌ', name: 'تنوين ضم' },
  { char: '\u064D', label: 'ـٍ', name: 'تنوين كسر' },
  { char: '\u0670', label: 'ـٰ', name: 'ألف خنجرية' },
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  curriculum,
  onAddWord,
  onUpdateWord,
  onDeleteWord,
  sheetsConfig,
  onUpdateSheetsConfig,
  submissions,
  onClearSubmissions,
  onBackToApp,
  defaultEvalMode,
  onUpdateDefaultEvalMode,
  categories,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  subjects,
  onAddSubject,
  onRenameSubject,
  onDeleteSubject,
  onResetCurriculum,
  onImportCurriculum,
  onOpenSettings,
  onOpenGuide,
  onLogout,
  translations,
  onUpdateTranslations,
  geminiApiKey,
  onRefreshFromSheets,
}) => {
  const [activeTab, setActiveTab] = useState<'lessons' | 'submissions' | 'sheets' | 'translations'>('lessons');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [testStatus, setTestStatus] = useState<{ loading: boolean; message: string; success?: boolean } | null>(null);

  // Modals for Subject and Category Management
  const [showSubjectManager, setShowSubjectManager] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showSyncGuideModal, setShowSyncGuideModal] = useState(false);
  const [showQrSyncModal, setShowQrSyncModal] = useState(false);
  const [copiedSyncUrl, setCopiedSyncUrl] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrLoading, setQrLoading] = useState(false);

  // Google Sheets Guides Accordion Collapses
  const [showLessonsStructureGuide, setShowLessonsStructureGuide] = useState(false);
  const [showAnswersStructureGuide, setShowAnswersStructureGuide] = useState(false);
  const [showScriptCodeGuide, setShowScriptCodeGuide] = useState(false);

  // Confirm Sheets Connection
  const [isConfirmingConnection, setIsConfirmingConnection] = useState(false);
  const [connectionConfirmed, setConnectionConfirmed] = useState(false);

  // Live "answers 1" Submissions
  const [answers1Submissions, setAnswers1Submissions] = useState<Answers1SubmissionRow[]>([]);
  const [loadingAnswers1, setLoadingAnswers1] = useState(false);
  const [selectedSubmissionDetail, setSelectedSubmissionDetail] = useState<Answers1SubmissionRow | null>(null);
  const [submissionsSearch, setSubmissionsSearch] = useState('');

  // Curriculum Sub-tabs & Sync Statuses
  const [lessonsSubTab, setLessonsSubTab] = useState<'add' | 'list'>('list');
  const [saveFileStatus, setSaveFileStatus] = useState<{ loading: boolean; message: string; success?: boolean } | null>(null);
  const [copiedCurriculumCode, setCopiedCurriculumCode] = useState(false);
  const [isSyncingSheetsCurriculum, setIsSyncingSheetsCurriculum] = useState(false);
  const [isPushingCurriculumToSheets, setIsPushingCurriculumToSheets] = useState(false);
  const [sheetsCurriculumStatus, setSheetsCurriculumStatus] = useState<{ success: boolean; message: string } | null>(null);

  // AI Daily Quota & Usage Monitor
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus>(getDailyQuotaStatus());
  const [showBillingGuideModal, setShowBillingGuideModal] = useState(false);
  const [customMaxDailyInput, setCustomMaxDailyInput] = useState('');
  const [quotaNotice, setQuotaNotice] = useState<string | null>(null);

  // Sync quota updates across components
  React.useEffect(() => {
    const handleQuotaUpdate = () => {
      setQuotaStatus(getDailyQuotaStatus());
    };
    window.addEventListener('arabic-quota-updated', handleQuotaUpdate);
    return () => window.removeEventListener('arabic-quota-updated', handleQuotaUpdate);
  }, []);

  // AI Diagnostic Status
  const [aiDiagnostic, setAiDiagnostic] = useState<{
    checked: boolean;
    loading: boolean;
    configured?: boolean;
    status?: string;
    message?: string;
    error?: string;
    sample?: string;
  } | null>(null);

  // Subject Manager Temporary Inputs
  const [newSubjInput, setNewSubjInput] = useState('');
  const [editingSubjName, setEditingSubjName] = useState<{ old: string; new: string } | null>(null);

  // Category Manager Temporary Inputs
  const [newCatInput, setNewCatInput] = useState('');
  const [editingCatName, setEditingCatName] = useState<{ old: string; new: string } | null>(null);

  // Editing state (null = add new, string = id being edited)
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields (8 exact fields in order requested by user)
  const [lessonSubject, setLessonSubject] = useState(subjects[0] || INITIAL_LESSON_SUBJECTS[0]);
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categories[0] || 'الكلمة');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [autoReadText, setAutoReadText] = useState('');
  const [wordText, setWordText] = useState('');
  const [meaning, setMeaning] = useState('');
  const [makhrajTip, setMakhrajTip] = useState('');
  const [repeatCount, setRepeatCount] = useState<number>(1);
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>('medium');
  const [recordingDuration, setRecordingDuration] = useState<number>(5);

  // Teacher Voice Recording State (Inline quick recording)
  const [isRecordingTeacher, setIsRecordingTeacher] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Dedicated Voice Recording & Drive Upload Modal States (Issue 3)
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceRecordSeconds, setVoiceRecordSeconds] = useState(0);
  const [isRecordingVoiceModal, setIsRecordingVoiceModal] = useState(false);
  const [modalAudioBlob, setModalAudioBlob] = useState<Blob | null>(null);
  const [modalAudioBlobUrl, setModalAudioBlobUrl] = useState<string | null>(null);
  const [modalAudioBase64, setModalAudioBase64] = useState<string | null>(null);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveUploadResult, setDriveUploadResult] = useState<{ success: boolean; url?: string; message: string } | null>(null);
  const [customVoiceFileName, setCustomVoiceFileName] = useState('');
  const voiceModalRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceModalChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<any>(null);

  // Selected Lesson in View/Filter
  const [viewSelectedSubject, setViewSelectedSubject] = useState(subjects[0] || '');
  const [viewSelectedCategory, setViewSelectedCategory] = useState<string>('الكل');

  // Insert Tashkeel character
  const handleInsertTashkeel = (char: string) => {
    setWordText((prev) => prev + char);
  };

  // Add new dynamic category directly from form
  const handleAddNewCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    if (!categories.includes(trimmed)) {
      onAddCategory(trimmed);
    }
    setSelectedCategory(trimmed);
    setNewCategoryInput('');
  };

  // Handle Edit Click on an existing word item
  const handleStartEdit = (item: WordItem) => {
    setEditingId(item.id);
    setLessonSubject(item.lessonSubject || subjects[0]);
    setSelectedCategory(item.category || categories[0] || 'الكلمة');
    setImageUrl(item.imageUrl || '');
    setAudioUrl(item.audioUrl || '');
    setAutoReadText(item.autoReadText || '');
    setWordText(item.word);
    setMeaning(item.meaning || '');
    setMakhrajTip(item.makhrajTip || '');
    setRepeatCount(item.repeatCount || 1);
    setDifficultyLevel(item.difficultyLevel || 'medium');
    setRecordingDuration(item.recordingDuration || 5);
    setLessonsSubTab('add');

    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  // Cancel Edit
  const handleCancelEdit = () => {
    setEditingId(null);
    setWordText('');
    setMeaning('');
    setMakhrajTip('');
    setImageUrl('');
    setAudioUrl('');
    setAutoReadText('');
    setRepeatCount(1);
    setDifficultyLevel('medium');
    setRecordingDuration(5);
    setLessonsSubTab('list');
  };

  // Handle Local File Upload for Image
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Local File Upload for Audio
  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAudioUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Teacher Microphone Recording
  const startTeacherRecording = async () => {
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const base64 = await blobToBase64(audioBlob);
        setAudioUrl(`data:audio/webm;base64,${base64}`);
        stream.getTracks().forEach((track) => track.stop());
        setIsRecordingTeacher(false);
      };

      mediaRecorder.start();
      setIsRecordingTeacher(true);
    } catch (err) {
      console.error('Microphone error:', err);
      alert('يرجى السماح بالوصول للميكروفون لتسجيل صوت المعلم.');
    }
  };

  const stopTeacherRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // Dedicated Voice Recording & Drive Upload Handlers (Issue 3)
  const handleOpenVoiceModal = () => {
    setShowVoiceModal(true);
    setVoiceRecordSeconds(0);
    setIsRecordingVoiceModal(false);
    setModalAudioBlob(null);
    setModalAudioBlobUrl(null);
    setModalAudioBase64(null);
    setDriveUploadResult(null);
  };

  const handleStartVoiceModalRecording = async () => {
    try {
      voiceModalChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      voiceModalRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          voiceModalChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(voiceModalChunksRef.current, { type: 'audio/webm' });
        const blobUrl = URL.createObjectURL(audioBlob);
        const base64 = await blobToBase64(audioBlob);
        setModalAudioBlob(audioBlob);
        setModalAudioBlobUrl(blobUrl);
        setModalAudioBase64(base64);
        stream.getTracks().forEach((track) => track.stop());
        setIsRecordingVoiceModal(false);
        if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      };

      mediaRecorder.start();
      setIsRecordingVoiceModal(true);
      setVoiceRecordSeconds(0);
      voiceTimerRef.current = setInterval(() => {
        setVoiceRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
      alert('يرجى السماح بالوصول للميكروفون لبدء تسجيل صوت المعلم.');
    }
  };

  const handleStopVoiceModalRecording = () => {
    if (voiceModalRecorderRef.current && voiceModalRecorderRef.current.state !== 'inactive') {
      voiceModalRecorderRef.current.stop();
    }
    if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
  };

  const handleResetVoiceModalRecording = () => {
    if (modalAudioBlobUrl) URL.revokeObjectURL(modalAudioBlobUrl);
    setModalAudioBlob(null);
    setModalAudioBlobUrl(null);
    setModalAudioBase64(null);
    setDriveUploadResult(null);
    setVoiceRecordSeconds(0);
    setIsRecordingVoiceModal(false);
  };

  const handleUploadModalAudioToDrive = async () => {
    if (!modalAudioBase64) {
      alert('لا يوجد صوت مسجل للرفع.');
      return;
    }

    const effectiveWebhook = (sheetsConfig.webhookUrl || DEFAULT_WEBHOOK_URL).trim();
    const rawFolder = (sheetsConfig.driveFolderId || DEFAULT_DRIVE_AUDIO_FOLDER_ID || '').trim();
    const targetFolder = rawFolder || DEFAULT_DRIVE_AUDIO_FOLDER_ID;
    setIsUploadingToDrive(true);
    setDriveUploadResult(null);

    const finalAudioName = customVoiceFileName.trim() || wordText.trim() || 'صوت_شرح';
    const res = await uploadAudioToDrive(
      effectiveWebhook,
      modalAudioBase64,
      finalAudioName,
      targetFolder,
      customVoiceFileName.trim() || undefined
    );

    setIsUploadingToDrive(false);
    if (res.success && res.audioUrl) {
      setAudioUrl(res.audioUrl);
      setDriveUploadResult({
        success: true,
        url: res.audioUrl,
        message: 'تم حفظ الصوت ورفعه إلى Google Drive بنجاح! تم وضعه تلقائياً في حقل رابط الصوت.',
      });
    } else {
      setDriveUploadResult({
        success: false,
        message: res.message || 'فشل الرفع إلى Google Drive. يرجى التأكد من نشر نسخة السكربت الجديدة.',
      });
    }
  };

  // Handle Form Submit (Add or Edit)
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wordText.trim()) {
      alert('يرجى إدخال الكلمة أو الحرف');
      return;
    }

    let finalSubject = lessonSubject;
    if (customSubjectInput.trim()) {
      finalSubject = customSubjectInput.trim();
      onAddSubject(finalSubject);
    }

    const wordItem: WordItem = {
      id: editingId || `custom-${Date.now()}`,
      word: wordText.trim(),
      plainWord: removeTashkeel(wordText.trim()),
      meaning: meaning.trim() || 'كلمة تعليمية',
      category: selectedCategory,
      lessonSubject: finalSubject,
      imageUrl: imageUrl.trim() || undefined,
      audioUrl: audioUrl.trim() || undefined,
      autoReadText: autoReadText.trim() || undefined,
      makhrajTip: makhrajTip.trim() || 'انطق الكلمة بوضوح مع مراعاة الحركات المشكّلة.',
      letterFocus: wordText.trim()[0],
      repeatCount: repeatCount > 1 ? repeatCount : 1,
      difficultyLevel: difficultyLevel,
      recordingDuration: recordingDuration >= 2 ? recordingDuration : 5,
    };

    if (editingId) {
      onUpdateWord(wordItem);
      alert('تم حفظ التعديلات بنجاح!');
      setEditingId(null);
    } else {
      onAddWord(wordItem);
      alert('تمت إضافة الكلمة إلى الدرس بنجاح!');
    }

    // Auto-sync to Google Sheets (Sheet: "الدروس" & Google Drive Folder) if webhook is active
    if (sheetsConfig.enabled && sheetsConfig.webhookUrl) {
      saveWordToGoogleSheets(
        sheetsConfig.webhookUrl,
        wordItem,
        audioUrl.startsWith('data:audio') ? audioUrl : undefined,
        sheetsConfig.driveFolderId || DEFAULT_DRIVE_AUDIO_FOLDER_ID
      ).then((res) => {
        if (res.success) {
          if (res.audioUrl) {
            wordItem.audioUrl = res.audioUrl;
            onUpdateWord(wordItem);
          }
          setSheetsCurriculumStatus({
            success: true,
            message: `تم حفظ ومزامنة تمرين "${wordItem.word}" تلقائياً في ورقة "الدروس" بـ Google Sheets!`,
          });
        }
      });
    }

    // Switch to list sub-tab so the teacher can see the updated word in the curriculum
    setLessonsSubTab('list');

    // Reset fields
    setWordText('');
    setMeaning('');
    setMakhrajTip('');
    setImageUrl('');
    setAudioUrl('');
    setAutoReadText('');
    setCustomSubjectInput('');
    setRepeatCount(1);
    setDifficultyLevel('medium');
  };

  // Test play audio from field
  const handleTestAudio = () => {
    const textToPlay = autoReadText.trim() || wordText.trim() || 'مَرْحَبًا بِكُمْ';
    if (audioUrl.trim()) {
      playCustomAudio(audioUrl, textToPlay, 0.85);
    } else {
      playUniversalArabicStream(textToPlay, 0.85);
    }
  };

  const handleCopyScriptCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleTestSheetsConnection = async () => {
    const targetUrl = (sheetsConfig.webhookUrl || DEFAULT_WEBHOOK_URL).trim();
    if (!targetUrl) {
      alert('يرجى إدخال رابط Google Sheets Webhook أولاً');
      return;
    }

    setTestStatus({ loading: true, message: 'جاري فحص الاتصال مع Google Sheets ومعاينة الورقة النشطة...' });

    // First, inspect the active spreadsheet and sheet tab live
    try {
      const inspectRes = await fetchCurriculumFromSheets(targetUrl);
      if (inspectRes.success) {
        setTestStatus({
          loading: false,
          success: true,
          message: `الاتصال ممتاز ومكتمل! متصل بملف: (${inspectRes.spreadsheetName || 'Google Sheets'}) | الورقة النشطة: [${inspectRes.sheetName || 'الدروس'}] | عدد التمارين الحالية بالشيت: ${inspectRes.curriculum?.length || 0} كلمة.`,
        });
        return;
      }
    } catch (e) {
      console.warn('Inspect fetch error:', e);
    }

    const dummyRecord: StudentSubmissionRecord = {
      id: `test-${Date.now()}`,
      studentName: 'طالب تجريبي (اختبار)',
      word: 'اخْتِبَارٌ نَاجِحٌ',
      score: 100,
      grade: 'ممتاز',
      detectedWord: 'اختبار ناجح',
      feedback: 'هذا صف تجريبي للتأكد من اتصال فصيح مع Google Sheets بنجاح.',
      engineUsed: 'local',
      timestamp: Date.now(),
      syncedToSheets: false,
    };

    const res = await sendScoreToGoogleSheets(targetUrl, dummyRecord);
    setTestStatus({
      loading: false,
      success: res.success,
      message: res.message,
    });
  };

  // Sync lessons and curriculum directly from sheet "الدروس"
  const handleSyncCurriculumFromSheets = async () => {
    const targetUrl = (sheetsConfig.webhookUrl || DEFAULT_WEBHOOK_URL).trim();
    if (!targetUrl) {
      alert('يرجى إدخال رابط Google Sheets Webhook أولاً');
      return;
    }

    setIsSyncingSheetsCurriculum(true);
    setSheetsCurriculumStatus(null);

    const res = await fetchCurriculumFromSheets(targetUrl);
    setIsSyncingSheetsCurriculum(false);

    if (res.success && res.curriculum && res.curriculum.length > 0) {
      onImportCurriculum(res.curriculum);
      if (res.subjects && res.subjects.length > 0) {
        res.subjects.forEach((s) => onAddSubject(s));
      }
      if (res.categories && res.categories.length > 0) {
        res.categories.forEach((c) => onAddCategory(c));
      }
      onUpdateSheetsConfig({ lastSyncTime: Date.now() });
      const targetSheetDesc = res.sheetName ? `ورقة [${res.sheetName}]` : 'ورقة "الدروس"';
      const targetFileDesc = res.spreadsheetName ? ` في ملف (${res.spreadsheetName})` : '';
      setSheetsCurriculumStatus({
        success: true,
        message: `تم بنجاح جلب ${res.curriculum.length} كلمة وتدريب من ${targetSheetDesc}${targetFileDesc}!`,
      });
    } else {
      setSheetsCurriculumStatus({
        success: false,
        message: res.error || 'تعذر جلب البيانات. تأكد من تسمية الورقة (الدروس) ومطابقة الأعمدة A:I ونشر السكربت بوضعية Anyone.',
      });
    }
  };

  // Sync entire curriculum from the App into sheet "الدروس" (App -> Google Sheets)
  const handleSyncCurriculumToSheets = async () => {
    const targetUrl = (sheetsConfig.webhookUrl || DEFAULT_WEBHOOK_URL).trim();
    if (!targetUrl) {
      alert('يرجى إدخال رابط Google Sheets Webhook أولاً');
      return;
    }

    setIsPushingCurriculumToSheets(true);
    setSheetsCurriculumStatus(null);

    const res = await syncAllCurriculumToSheets(
      targetUrl,
      curriculum,
      sheetsConfig.driveFolderId || DEFAULT_DRIVE_AUDIO_FOLDER_ID
    );
    setIsPushingCurriculumToSheets(false);

    setSheetsCurriculumStatus({
      success: res.success,
      message: res.message,
    });
  };

  // Generate TypeScript code for src/data/arabicCurriculum.ts
  const generateCurriculumTS = () => {
    return `import { WordItem } from '../types';

export const INITIAL_LESSON_SUBJECTS = ${JSON.stringify(subjects, null, 2)};

export const INITIAL_CATEGORIES = ${JSON.stringify(categories, null, 2)};

export const ALL_CURRICULUM: WordItem[] = ${JSON.stringify(curriculum, null, 2)};
`;
  };

  // Save updated curriculum directly into server code file src/data/arabicCurriculum.ts
  const handleSaveToServer = async () => {
    setSaveFileStatus({ loading: true, message: 'جاري الحفظ في ملف src/data/arabicCurriculum.ts...' });
    try {
      const res = await fetch('/api/save-curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curriculum, subjects, categories }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveFileStatus({
          loading: false,
          success: true,
          message: `تم حفظ ${curriculum.length} كلمة ودرس بنجاح في ملفات المشروع! الآن عند تصدير المشروع أو رفعه إلى GitHub ستظهر الدروس فوراً على كل الجوالات والتابليت.`,
        });
      } else {
        setSaveFileStatus({
          loading: false,
          success: false,
          message: data.error || 'تعذر الحفظ المباشر، يمكنك تحميل الملف عبر زر "تحميل ملف arabicCurriculum.ts".',
        });
      }
    } catch (err: any) {
      setSaveFileStatus({
        loading: false,
        success: false,
        message: 'تعذر الاتصال بخادم الحفظ التلقائي. يرجى استخدام زر "تحميل ملف arabicCurriculum.ts".',
      });
    }
  };

  // Download complete arabicCurriculum.ts file ready to replace on GitHub
  const handleDownloadTSFile = () => {
    const tsContent = generateCurriculumTS();
    const blob = new Blob([tsContent], { type: 'text/typescript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', 'arabicCurriculum.ts');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  };

  // Copy complete TypeScript code to clipboard
  const handleCopyTSCode = () => {
    const tsContent = generateCurriculumTS();
    navigator.clipboard.writeText(tsContent);
    setCopiedCurriculumCode(true);
    setTimeout(() => setCopiedCurriculumCode(false), 2500);
  };

  // Clean QR sync URL: points directly to current web application link
  const getSyncUrl = () => {
    if (typeof window === 'undefined') return '';
    return window.location.origin + window.location.pathname;
  };

  const handleLoadAnswers1 = async () => {
    const effectiveWebhook = (sheetsConfig.webhookUrl || DEFAULT_WEBHOOK_URL).trim();
    if (!effectiveWebhook) return;
    setLoadingAnswers1(true);
    try {
      const subs = await fetchAllSubmissionsFromSheet(effectiveWebhook);
      setAnswers1Submissions(subs);
    } catch (e) {
      console.warn('Failed to load answers 1 submissions:', e);
    } finally {
      setLoadingAnswers1(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'submissions' && sheetsConfig.webhookUrl) {
      handleLoadAnswers1();
    }
  }, [activeTab, sheetsConfig.webhookUrl]);

  const handleConfirmSheetsConnection = async () => {
    const effectiveWebhook = (sheetsConfig.webhookUrl || DEFAULT_WEBHOOK_URL).trim();
    if (!effectiveWebhook) {
      alert('يرجى إدخال رابط Google Sheets Webhook أولاً.');
      return;
    }
    setIsConfirmingConnection(true);
    setConnectionConfirmed(false);
    setTestStatus({ loading: true, message: 'جاري فحص وتأكيد الاتصال بـ Google Sheets...' });
    try {
      const res = await fetchCurriculumFromSheets(effectiveWebhook);
      setIsConfirmingConnection(false);
      if (res.success) {
        setConnectionConfirmed(true);
        onUpdateSheetsConfig({ webhookUrl: effectiveWebhook, enabled: true });
        setTestStatus({
          loading: false,
          success: true,
          message: `تم تأكيد الاتصال بنجاح! متصل بملف (${res.spreadsheetName || 'Google Sheets'}). تم حفظ الرابط تلقائياً! ✅`,
        });
      } else {
        setTestStatus({
          loading: false,
          success: false,
          message: res.error || 'تعذر الاتصال بـ Webhook. تأكد من نشر السكربت كـ Web App بصلاحية Anyone.',
        });
      }
    } catch (err: any) {
      setIsConfirmingConnection(false);
      setTestStatus({
        loading: false,
        success: false,
        message: err.message || 'فشل الاتصال بـ Google Sheets Webhook.',
      });
    }
  };

  const handleOpenQrModal = async () => {
    setShowQrSyncModal(true);
    setQrLoading(true);
    try {
      const url = getSyncUrl();
      const dataUrl = await QRCode.toDataURL(url, {
        width: 260,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setQrDataUrl(dataUrl);
    } catch (e) {
      console.warn('QR generation error:', e);
    } finally {
      setQrLoading(false);
    }
  };

  const handleCopySyncUrl = () => {
    const url = getSyncUrl();
    navigator.clipboard.writeText(url);
    setCopiedSyncUrl(true);
    setTimeout(() => setCopiedSyncUrl(false), 2500);
  };

  // Quota Management Handlers
  const handleResetDailyQuota = () => {
    const updated = resetDailyQuota();
    setQuotaStatus(updated);
    setQuotaNotice('تم تصفير عداد الاستهلاك اليومي بنجاح إلى (0 محاولة).');
    setTimeout(() => setQuotaNotice(null), 3500);
  };

  const handleUpdateMaxDailyQuota = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(customMaxDailyInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      const updated = setDailyMaxQuota(parsed);
      setQuotaStatus(updated);
      setCustomMaxDailyInput('');
      setQuotaNotice(`تم تحديث الحد اليومي إلى (${parsed} محاولة) بنجاح.`);
      setTimeout(() => setQuotaNotice(null), 3500);
    }
  };

  // AI Diagnostic Check Handler
  const handleCheckAIStatus = async () => {
    setAiDiagnostic({ checked: true, loading: true });
    try {
      const res = await fetch('/api/ai-status');
      const data = await res.json();
      setAiDiagnostic({
        checked: true,
        loading: false,
        configured: data.configured,
        status: data.status,
        message: data.message,
        error: data.error,
        sample: data.sample,
      });
    } catch (err: any) {
      setAiDiagnostic({
        checked: true,
        loading: false,
        configured: false,
        status: 'error',
        error: 'فشل الاتصال بنقطة الفحص /api/ai-status على السيرفر.',
      });
    }
  };

  // Export curriculum as JSON for GitHub backup
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(curriculum, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'faseeh_curriculum.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import curriculum from JSON file
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].word) {
          onImportCurriculum(parsed);
          alert(`تم استيراد ${parsed.length} كلمة ودرس بنجاح إلى هذا الجهاز!`);
        } else {
          alert('ملف JSON غير صالح، يرجى اختيار ملف المنهج المصدر.');
        }
      } catch (err) {
        alert('حدث خطأ أثناء قراءة ملف JSON');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filter items in the list view by selected subject and category
  const filteredCurriculum = curriculum.filter((item) => {
    const matchSubject = !viewSelectedSubject || item.lessonSubject === viewSelectedSubject;
    const matchCategory = viewSelectedCategory === 'الكل' || item.category === viewSelectedCategory;
    const matchSearch =
      !searchQuery.trim() ||
      item.word.includes(searchQuery) ||
      item.plainWord.includes(searchQuery) ||
      item.meaning.includes(searchQuery);
    return matchSubject && matchCategory && matchSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-cairo flex flex-col">
      {/* Admin Top Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-900 flex items-center justify-center font-bold text-lg">
              ⚙
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold">
                  لوحة إدارة المعلم والدروس
                </h1>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                  الرابط السري: /#control
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                إدارة الكلمات، تعديل وحذف الدروس، ربط Google Sheets، والتحكم بالتقييم
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Unified Guide & Settings Button */}
            {onOpenGuide && (
              <button
                onClick={onOpenGuide}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                title="دليل النظام وإعدادات الصوت والتقييم"
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>الدليل</span>
              </button>
            )}

            {/* Refresh from sheets button */}
            {onRefreshFromSheets && (
              <button
                onClick={async () => {
                  try {
                    await onRefreshFromSheets();
                    alert('✨ تم جلب وتحديث كافة الدروس والبيانات والترجمات بنجاح من ورقة Google Sheets!');
                  } catch (e: any) {
                    alert('تعذر التحديث من الشيت: ' + (e?.message || 'خطأ في الاتصال'));
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="تحديث وجلب كافة التعديلات والبيانات مباشرة من ورقة Google Sheets"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">تحديث من الشيت 🔄</span>
              </button>
            )}

            {/* QR Sync Button (Text: QR with Icon only) */}
            <button
              onClick={handleOpenQrModal}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
              title="رمز QR لفتح التطبيق على الجوال والتابليت فوراً"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR</span>
            </button>

            <button
              onClick={onBackToApp}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="العودة لواجهة الطالب"
            >
              <span>صفحة الطالب</span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>

            {/* Admin Logout button: Icon only without text */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="تسجيل الخروج من لوحة الإدارة"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Admin Body */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col gap-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('lessons')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'lessons'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>إدارة الكلمات والدروس ({curriculum.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('submissions');
              if (answers1Submissions.length === 0 && !loadingAnswers1) {
                handleLoadAnswers1();
              }
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'submissions'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>نتائج الطلاب (answers 1)</span>
          </button>

          <button
            onClick={() => setActiveTab('sheets')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'sheets'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <Settings className="w-4 h-4 text-emerald-500" />
            <span>إعدادات ربط Google Sheets</span>
            {sheetsConfig.enabled && sheetsConfig.webhookUrl && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('translations')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'translations'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <Languages className="w-4 h-4 text-indigo-500" />
            <span>إدارة وتخصيص الترجمة (التايلاندية / الإنجليزية)</span>
          </button>
        </div>

        {/* TAB 1: LESSONS & WORDS MANAGEMENT */}
        {activeTab === 'lessons' && (
          <div className="space-y-5">
            {/* Sub-Tabs Switcher & Two-Way Sheets Sync Actions */}
            <div className="bg-white rounded-3xl p-3 sm:p-4 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLessonsSubTab('add')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                    lessonsSubTab === 'add'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>تبويب إضافة جديدة</span>
                  {editingId && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400 text-slate-950 font-bold animate-pulse">
                      قيد التعديل
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setLessonsSubTab('list')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                    lessonsSubTab === 'list'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>تبويب قائمة الدروس ({curriculum.length})</span>
                </button>
              </div>

              {/* Two-Way Google Sheets Sync Buttons: Push to Sheets & Pull from Sheets */}
              <div className="flex flex-wrap items-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                <button
                  onClick={handleSyncCurriculumToSheets}
                  disabled={isPushingCurriculumToSheets || !sheetsConfig.webhookUrl}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  title="رفع المنهج بالكامل من النظام إلى ورقة 'الدروس' في Google Sheets بالهيكل الأفقي"
                >
                  <Upload className={`w-3.5 h-3.5 ${isPushingCurriculumToSheets ? 'animate-bounce' : ''}`} />
                  <span>{isPushingCurriculumToSheets ? 'جاري الرفع للشيت...' : 'رفع المنهج إلى الشيت'}</span>
                </button>

                <button
                  onClick={handleSyncCurriculumFromSheets}
                  disabled={isSyncingSheetsCurriculum || !sheetsConfig.webhookUrl}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  title="سحب الدروس من جدول Google Sheets ورقة 'الدروس' إلى النظام"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheetsCurriculum ? 'animate-spin' : ''}`} />
                  <span>{isSyncingSheetsCurriculum ? 'جاري السحب...' : 'مزامنة من الشيت'}</span>
                </button>
              </div>
            </div>

            {/* Sheets Status Banner */}
            {sheetsCurriculumStatus && (
              <div
                className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in duration-200 ${
                  sheetsCurriculumStatus.success
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-rose-50 text-rose-900 border-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {sheetsCurriculumStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{sheetsCurriculumStatus.message}</span>
                </div>
                <button
                  onClick={() => setSheetsCurriculumStatus(null)}
                  className="text-xs opacity-60 hover:opacity-100 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* SUB-TAB 1: تبويب إضافة جديدة */}
            {lessonsSubTab === 'add' && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-100 max-w-4xl mx-auto w-full">
                <div className="flex items-center justify-between pb-3 mb-6 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                        editingId ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {editingId ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {editingId ? 'تعديل الكلمة أو الدرس' : 'إضافة كلمة أو تدريب جديد'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        وفق الحقول المرتبة ومتوافقة تماماً مع ورقة "الدروس" في Google Sheets
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {editingId ? (
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        إلغاء التعديل
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setLessonsSubTab('list')}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <span>عرض قائمة الدروس</span>
                        <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                      </button>
                    )}
                  </div>
                </div>

              <form onSubmit={handleSubmitForm} className="space-y-4">
                {/* 1. حقل نص موضوع الدرس مع زر الإدارة والتعديل والحذف */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      1- موضوع الدرس:
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowSubjectManager(true)}
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      <span>إدارة/تعديل/حذف الدروس</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <select
                      value={lessonSubject}
                      onChange={(e) => {
                        setLessonSubject(e.target.value);
                        setCustomSubjectInput('');
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-emerald-500"
                    >
                      {subjects.map((subj) => (
                        <option key={subj} value={subj}>
                          {subj}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={customSubjectInput}
                      onChange={(e) => setCustomSubjectInput(e.target.value)}
                      placeholder="أو اكتب اسم موضوع درس جديد هنا..."
                      className="w-full px-3 py-1.5 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* 2. الفئة مع زر الإدارة والتعديل والحذف */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      2- الفئة:
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCategoryManager(true)}
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      <span>إدارة/تعديل/حذف الفئات</span>
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-emerald-500"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* إضافة فئة جديدة فوراً */}
                  <div className="mt-2 flex gap-1.5">
                    <input
                      type="text"
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      placeholder="إضافة فئة جديدة..."
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddNewCategory}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                    >
                      + إضافة فئة
                    </button>
                  </div>
                </div>

                {/* 3. إضافة حقل رابط صورة (مع معاينة ورفع مباشر من الجهاز) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      3- رابط الصورة:
                    </label>
                    <label className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 cursor-pointer">
                      <Upload className="w-3 h-3" />
                      <span>رفع صورة من جهازي</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFileUpload}
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://... أو /images/word.png"
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono dir-ltr text-left focus:outline-hidden focus:border-emerald-500"
                    />
                    {imageUrl && (
                      <div className="relative group">
                        <img
                          src={getDirectImageUrl(imageUrl)}
                          alt="معاينة"
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                          onError={(e) => {
                            (e.target as any).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    يدعم روابط Google Drive و Dropbox ومجلدات GitHub والرفع المباشر.
                  </span>
                </div>

                {/* 4. إضافة حقل رابط صوت (مع زر التسجيل والرفع المباشر وقراءة آلية) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      4- خيارات الصوت (تسجيل مباشر / رفع ملف / وضع رابط):
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestAudio}
                        className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>تجربة الصوت</span>
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                    placeholder="https://... أو /audio/word.mp3 (اتركه فارغاً للقراءة الآلية)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono dir-ltr text-left focus:outline-hidden focus:border-emerald-500"
                  />

                  {/* أزرار مساعدة سريعة للصوت: نافذة التسجيل والرفع لـ Drive، رفع ملف محلي، وتسجيل سريع */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={handleOpenVoiceModal}
                      className="flex-1 min-w-[200px] flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow cursor-pointer"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>نافذة تسجيل الصوت والرفع إلى Drive (معاينة وحفظ)</span>
                    </button>

                    <label className="flex items-center justify-center gap-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>رفع ملف (MP3)</span>
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={handleAudioFileUpload}
                      />
                    </label>

                    {audioUrl && (
                      <button
                        type="button"
                        onClick={() => setAudioUrl('')}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        title="مسح رابط الصوت الحالي"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  
                  {/* مؤشر حالة الصوت */}
                  <div className="mt-1">
                    {audioUrl ? (
                      audioUrl.startsWith('data:audio') ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                          <CheckCheck className="w-3 h-3 text-emerald-600" />
                          <span>صوت محفوظ محلياً (مسجل بالميكروفون أو مرفوع مباشرة)</span>
                        </span>
                      ) : audioUrl.includes('drive.google.com') ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                          <Info className="w-3 h-3 text-blue-600" />
                          <span>رابط Google Drive (تأكد أن إذن المشاركة: أي شخص لديه الرابط - معلَن)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                          <Volume2 className="w-3 h-3 text-purple-600" />
                          <span>رابط صوت خارجي مخصص</span>
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                        <Volume2 className="w-3 h-3 text-emerald-600" />
                        <span>الحقل فارغ: سيقوم النظام بقراءة النص المخصص أدناه آلياً بصوت فصيح.</span>
                      </span>
                    )}
                  </div>

                  {/* الحقل المخصص للقراءة الآلية في حال عدم توفر تسجيل أو ملف أو رابط */}
                  <div className="mt-2.5 p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-emerald-950 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>نص مخصص للقراءة الآلية (عند عدم وجود تسجيل/ملف/رابط):</span>
                      </label>
                      {wordText && (
                        <button
                          type="button"
                          onClick={() => setAutoReadText(wordText)}
                          className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold hover:underline cursor-pointer"
                        >
                          نسخ الكلمة إلى هنا
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={autoReadText}
                      onChange={(e) => setAutoReadText(e.target.value)}
                      placeholder="اكتب هنا النص المشكول للقراءة الآلية (اتركه فارغاً لينطق الكلمة أعلاه تلقائياً)"
                      className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-lg font-amiri text-lg text-slate-900 focus:outline-hidden focus:border-emerald-600"
                    />
                    <div className="text-[10px] text-emerald-800 flex items-center justify-between pt-0.5">
                      <span>
                        إذا لم يتوفر صوت مرفوع أو مسجل، سيقرأ النظام هذا النص آلياً بصوت فصيح.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const t = autoReadText.trim() || wordText.trim() || 'مَرْحَبًا';
                          playUniversalArabicStream(t, 0.85);
                        }}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 cursor-pointer shrink-0 ml-1"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>استمع للنص الآلي</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 5. إضافة حقل الكلمة او الحرف او جملة */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    5- الكلمة أو الحرف أو الجملة:
                  </label>
                  <input
                    type="text"
                    required
                    value={wordText}
                    onChange={(e) => setWordText(e.target.value)}
                    placeholder="مثال: قَمَرٌ، كَتَبَ، السَّلَامُ عَلَيْكُمْ..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-amiri text-2xl text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {/* 6. شريط التشكيل السريع */}
                <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
                  <span className="block text-[11px] font-bold text-slate-600 mb-1.5">
                    6- شريط التشكيل السريع (اضغط لإضافة الحركة):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {TASHKEEL_BUTTONS.map((t) => (
                      <button
                        key={t.char}
                        type="button"
                        onClick={() => handleInsertTashkeel(t.char)}
                        className="px-2.5 py-1 bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-lg font-amiri text-base font-bold text-slate-800 transition-colors shadow-2xs cursor-pointer"
                        title={t.name}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 7. حقل نص .. المعنى و التوضيح */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    7- المعنى والتوضيح:
                  </label>
                  <input
                    type="text"
                    value={meaning}
                    onChange={(e) => setMeaning(e.target.value)}
                    placeholder="مثال: اسم يدل على جرم سماوي منير..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                {/* 8. ارشادات المخرج الصوتي */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    8- إرشادات المخرج الصوتي:
                  </label>
                  <textarea
                    rows={2}
                    value={makhrajTip}
                    onChange={(e) => setMakhrajTip(e.target.value)}
                    placeholder="مثال: القاف من أقصى اللسان مع الحنك اللحمي..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-emerald-500 resize-none"
                  />
                </div>

                {/* 9. عدد مرات التكرار المطلوبة */}
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                      <span>9- عدد مرات التكرار المطلوبة للتقييم:</span>
                    </label>
                    <span className="text-[11px] text-amber-800 font-bold">
                      {repeatCount > 1 ? `${repeatCount} مرات متتالية` : 'مرة واحدة (افتراضي)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={repeatCount}
                      onChange={(e) => setRepeatCount(Math.max(1, parseInt(e.target.value) || 1))}
                      placeholder="1"
                      className="w-24 px-3 py-2 bg-white border border-amber-300 rounded-xl text-sm font-bold text-center text-amber-950 focus:outline-hidden focus:border-amber-500 shadow-2xs"
                    />
                    <span className="text-xs text-amber-900 font-medium">
                      تكرار (الافتراضي 1 تلقائياً)
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-800/90 mt-1.5 block leading-relaxed">
                    اكتب عدد مرات التكرار المطلوبة (الافتراضي 1). يقوم النظام بالتحقق منها وخصم الدرجات إن نقص التكرار.
                  </span>
                </div>

                {/* 10. مستوى تدقيق وتقييم النطق */}
                <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-sky-600" />
                      <span>10- مستوى تدقيق وتقييم النطق:</span>
                    </label>
                    <span className="text-[11px] text-sky-800 font-bold">
                      {difficultyLevel === 'easy'
                        ? '🟢 سهل (متساهل)'
                        : difficultyLevel === 'hard'
                        ? '🔴 متقدم (صارم)'
                        : '🟡 متوسط (متوازن)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDifficultyLevel('easy')}
                      className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                        difficultyLevel === 'easy'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>سهل (مبتدئ)</span>
                        <span>🟢</span>
                      </div>
                      <span className={`text-[10px] mt-1 ${difficultyLevel === 'easy' ? 'text-emerald-100' : 'text-slate-500'}`}>
                        تساهل في مخارج الحروف القريبة والحركات وتشجيع الطالب
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDifficultyLevel('medium')}
                      className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                        difficultyLevel === 'medium'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>متوسط (افتراضي)</span>
                        <span>🟡</span>
                      </div>
                      <span className={`text-[10px] mt-1 ${difficultyLevel === 'medium' ? 'text-sky-100' : 'text-slate-500'}`}>
                        تدقيق متوازن في الحروف مع تساهل في سكون أواخر الكلمة
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDifficultyLevel('hard')}
                      className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                        difficultyLevel === 'hard'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>متقدم (إتقان)</span>
                        <span>🔴</span>
                      </div>
                      <span className={`text-[10px] mt-1 ${difficultyLevel === 'hard' ? 'text-purple-100' : 'text-slate-500'}`}>
                        تدقيق صارم في كل حركة والهمزات والتكرارات دون تساهل
                      </span>
                    </button>
                  </div>
                </div>

                {/* 11. مدة التسجيل المخصصة بالثواني */}
                <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-2xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-purple-600" />
                      <span>11- مدة التسجيل التلقائي (بالثواني):</span>
                    </label>
                    <span className="text-[11px] text-purple-800 font-bold">
                      {recordingDuration} ثوانٍ
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="number"
                      min={2}
                      max={60}
                      value={recordingDuration}
                      onChange={(e) => setRecordingDuration(Math.max(2, parseInt(e.target.value) || 5))}
                      placeholder="5"
                      className="w-24 px-3 py-2 bg-white border border-purple-300 rounded-xl text-sm font-bold text-center text-purple-950 focus:outline-hidden focus:border-purple-500 shadow-2xs"
                    />
                    <span className="text-xs text-purple-900 font-medium">
                      ثوانٍ (الافتراضي 5 ثوانٍ، وتُحفظ بالعامود الثامن H بالشيت)
                    </span>
                  </div>
                  <span className="text-[10px] text-purple-800/90 mt-1.5 block leading-relaxed">
                    تُدمج هذه القيمة في العامود الثامن (H) بالشيت مع التكرار والمستوى (مثال: 3,متقدم,7)، وتحدد توقيت إيقاف التسجيل التلقائي للطالب.
                  </span>
                </div>

                {/* Submit button */}
                <div className="flex gap-2 pt-1">
                  {editingId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      إلغاء
                    </button>
                  )}
                  <button
                    type="submit"
                    className={`flex-1 py-2.5 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      editingId
                        ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    }`}
                  >
                    {editingId ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>حفظ التعديلات</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>إضافة الكلمة للمنهج</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
            )}

            {/* SUB-TAB 2: تبويب قائمة الدروس */}
            {lessonsSubTab === 'list' && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-100 flex flex-col space-y-4 w-full">
                {/* Header with Lesson Subject selector, Add button, and Search */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 block mb-0.5">
                        تصفية حسب موضوع الدرس:
                      </span>
                      <select
                        value={viewSelectedSubject}
                        onChange={(e) => {
                          setViewSelectedSubject(e.target.value);
                          setViewSelectedCategory('الكل');
                        }}
                        className="px-3 py-1.5 bg-slate-100 font-bold text-slate-800 border border-slate-200 rounded-xl text-xs focus:outline-hidden"
                      >
                        {subjects.map((subj) => (
                          <option key={subj} value={subj}>
                            {subj}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => setShowSubjectManager(true)}
                      className="mt-4 p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="تعديل أو حذف أسماء الدروس"
                    >
                      <Settings2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        handleCancelEdit();
                        setLessonsSubTab('add');
                      }}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة تمرين جديد</span>
                    </button>

                    <div className="relative w-44">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="بحث في الكلمات..."
                        className="w-full pl-2 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

              {/* Category tabs for the selected lesson */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => setViewSelectedCategory('الكل')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    viewSelectedCategory === 'الكل'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  الكل
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setViewSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      viewSelectedCategory === cat
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Items Cards */}
              <div className="flex-1 overflow-y-auto max-h-[560px] space-y-2 pr-1">
                {filteredCurriculum.length === 0 ? (
                  <div className="text-center py-16 text-xs text-slate-400">
                    لا توجد كلمات تحت هذا التصنيف في هذا الدرس حالياً.
                  </div>
                ) : (
                  filteredCurriculum.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-2xl flex items-center justify-between gap-3 hover:bg-slate-100/70 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Image Thumbnail if available */}
                        {item.imageUrl ? (
                          <img
                            src={getDirectImageUrl(item.imageUrl)}
                            alt={item.word}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                            onError={(e) => {
                              (e.target as any).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 text-emerald-700 flex items-center justify-center font-amiri text-xl font-bold shrink-0">
                            {item.word[0] || 'ك'}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-amiri text-2xl font-bold text-slate-900">
                              {item.word}
                            </span>
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold">
                              {item.category}
                            </span>
                            {item.audioUrl ? (
                              <span className="text-[10px] text-emerald-600 font-bold" title="يحتوي على صوت مخصص">
                                🎙️ صوت
                              </span>
                            ) : item.autoReadText ? (
                              <span className="text-[10px] text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded-md font-bold" title={`نص قراءة آلية: ${item.autoReadText}`}>
                                🤖 قراءة: {item.autoReadText}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium" title="قراءة آلية للكلمة">
                                🔊 آلي
                              </span>
                            )}
                            {item.repeatCount && item.repeatCount > 1 && (
                              <span className="text-[10px] text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-md font-bold" title={`يتطلب تكرار الكلمة ${item.repeatCount} مرات`}>
                                🔁 {item.repeatCount}×
                              </span>
                            )}
                            {item.difficultyLevel === 'easy' ? (
                              <span className="text-[10px] text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded-md font-bold" title="مستوى التدقيق: سهل (مبتدئ)">
                                🟢 سهل
                              </span>
                            ) : item.difficultyLevel === 'hard' ? (
                              <span className="text-[10px] text-purple-800 bg-purple-100 border border-purple-300 px-1.5 py-0.5 rounded-md font-bold" title="مستوى التدقيق: متقدم (صارم)">
                                🔴 متقدم
                              </span>
                            ) : (
                              <span className="text-[10px] text-sky-800 bg-sky-100 border border-sky-300 px-1.5 py-0.5 rounded-md font-bold" title="مستوى التدقيق: متوسط (متوازن)">
                                🟡 متوسط
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[260px] mt-0.5">
                            {item.meaning}
                          </div>
                          {item.makhrajTip && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[260px]">
                              💡 {item.makhrajTip}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Controls: Play Audio, Edit, Delete */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            const textToSpeak = item.autoReadText || item.word;
                            if (item.audioUrl) {
                              playCustomAudio(item.audioUrl, textToSpeak, 0.85);
                            } else {
                              playUniversalArabicStream(textToSpeak, 0.85);
                            }
                          }}
                          className="p-2 bg-white text-emerald-700 hover:bg-emerald-50 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                          title="استمع للصوت"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleStartEdit(item)}
                          className="p-2 bg-white text-amber-700 hover:bg-amber-50 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                          title="تعديل الحقول"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف "${item.word}" نهائياً من المنهج؟`)) {
                              onDeleteWord(item.id);
                              if (sheetsConfig.enabled && sheetsConfig.webhookUrl) {
                                deleteWordFromGoogleSheets(sheetsConfig.webhookUrl, item.word, item.lessonSubject);
                              }
                            }
                          }}
                          className="p-2 bg-white text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                          title="حذف الكلمة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            )}
          </div>
        )}

        {/* TAB 2: GOOGLE SHEETS INTEGRATION */}
        {activeTab === 'sheets' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-100 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Settings className="w-6 h-6 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    إعدادات ربط Google Sheets ومجلدات Google Drive
                  </h3>
                  <p className="text-xs text-slate-500">
                    مزامنة الدروس تلقائياً، حفظ أصوات وشروحات المعلم، وتوثيق إجابات الطلاب في ورقة answers 1
                  </p>
                </div>
              </div>
            </div>

            {/* Test Status Banner */}
            {testStatus && (
              <div
                className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
                  testStatus.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {testStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span>{testStatus.message}</span>
              </div>
            )}

            {/* Webhook Configuration Inputs */}
            <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  رابط Google Sheets Webhook (رابط تطبيق الويب Apps Script):
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="url"
                    value={sheetsConfig.webhookUrl}
                    onChange={(e) => {
                      setConnectionConfirmed(false);
                      onUpdateSheetsConfig({
                        webhookUrl: e.target.value,
                        enabled: !!e.target.value.trim(),
                      });
                    }}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-hidden focus:border-emerald-500 dir-ltr text-left"
                  />
                  <button
                    type="button"
                    onClick={handleConfirmSheetsConnection}
                    disabled={isConfirmingConnection}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                      connectionConfirmed
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {isConfirmingConnection ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري الفحص...</span>
                      </>
                    ) : connectionConfirmed ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                        <span>تم تأكيد الاتصال بنجاح! ✅</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>تأكيد الاتصال</span>
                      </>
                    )}
                  </button>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  انسخ الرابط الناتج من خطوة نشر الـ Apps Script وضعه هنا ثم انقر "تأكيد الاتصال" لفحصه وحفظه.
                </span>
              </div>

              <div className="space-y-4 pt-1">
                {/* 1. مجلد صوتيات وشرح المعلم */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl">
                  <label className="block text-xs font-bold text-slate-800 mb-1.5 flex flex-wrap items-center justify-between gap-1">
                    <span className="flex items-center gap-1.5 text-emerald-900 font-extrabold">
                      <Volume2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>2- مجلد Google Drive لأصوات وشرح المعلم (معرف المجلد):</span>
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100/70 px-2 py-0.5 rounded-md">
                      {sheetsConfig.teacherDriveFolderId || sheetsConfig.driveFolderId
                        ? `مجلد مخصص`
                        : `الافتراضي: 1YuCKWxGjQn9E2EAKqoKN-7-Kl_UeDC4t`}
                    </span>
                  </label>
                  <input
                    type="text"
                    value={sheetsConfig.teacherDriveFolderId ?? sheetsConfig.driveFolderId ?? DEFAULT_DRIVE_AUDIO_FOLDER_ID}
                    onChange={(e) =>
                      onUpdateSheetsConfig({
                        teacherDriveFolderId: e.target.value.trim(),
                        driveFolderId: e.target.value.trim(),
                      })
                    }
                    placeholder="1YuCKWxGjQn9E2EAKqoKN-7-Kl_UeDC4t"
                    className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-hidden focus:border-emerald-500 dir-ltr text-left"
                  />
                  <span className="text-[11px] text-slate-500 mt-1.5 block">
                    🎙️ مخصص لتسجيلات صوت المعلم النموذجية وشروحات الدروس التي تُضاف للمنهج عبر لوحة الإدارة.
                  </span>
                </div>

                {/* 2. مجلد تسجيلات أصوات الطلاب */}
                <div className="p-3.5 bg-indigo-50/60 border border-indigo-200/90 rounded-2xl">
                  <label className="block text-xs font-bold text-slate-800 mb-1.5 flex flex-wrap items-center justify-between gap-1">
                    <span className="flex items-center gap-1.5 text-indigo-950 font-extrabold">
                      <Mic className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>3- مجلد Google Drive لتسجيلات أصوات الطلاب (معرف المجلد):</span>
                    </span>
                    <span className="text-[11px] text-indigo-700 font-bold bg-indigo-100/70 px-2 py-0.5 rounded-md">
                      {sheetsConfig.studentDriveFolderId
                        ? `مجلد مخصص`
                        : `الافتراضي: 1o80NgUVp64TwTt_yRn3I83c6gy8Ce1iA`}
                    </span>
                  </label>
                  <input
                    type="text"
                    value={sheetsConfig.studentDriveFolderId ?? STUDENT_AUDIO_DRIVE_FOLDER_ID}
                    onChange={(e) =>
                      onUpdateSheetsConfig({
                        studentDriveFolderId: e.target.value.trim(),
                      })
                    }
                    placeholder="1o80NgUVp64TwTt_yRn3I83c6gy8Ce1iA"
                    className="w-full px-4 py-2 bg-white border border-indigo-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-hidden focus:border-indigo-500 dir-ltr text-left"
                  />
                  <span className="text-[11px] text-indigo-900/80 mt-1.5 block">
                    🎧 مخصص لحفظ تسجيلات نطق الطلاب عند إرسال الإجابة، حيث تُرفع الملفات الصوتية فيه وتُسجل الروابط تلقائياً في ورقة (answers 1).
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    مزامنة الدروس تلقائياً عند فتح الموقع على كل الأجهزة
                  </div>
                  <div className="text-[11px] text-slate-500">
                    تظهر الدروس الجديدة المضافة في ورقة "الدروس" لجميع الطلاب فوراً دون إعادة نشر
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={sheetsConfig.syncCurriculumFromSheets !== false}
                  onChange={(e) => onUpdateSheetsConfig({ syncCurriculumFromSheets: e.target.checked })}
                  className="w-5 h-5 text-emerald-600 rounded-sm focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Accordion 1: Structure of sheet "الدروس" Guide Card */}
            <div className="border border-emerald-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
              <button
                type="button"
                onClick={() => setShowLessonsStructureGuide(!showLessonsStructureGuide)}
                className="w-full p-4 bg-emerald-50/70 hover:bg-emerald-100/60 flex items-center justify-between transition-colors text-right cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs font-bold text-emerald-950">
                    📖 هيكل ورقة (الدروس) المعتمد في Google Sheets (نظام التمارين الأفقية للدرس)
                  </span>
                </div>
                <span className="text-xs font-bold text-emerald-700 font-mono">
                  {showLessonsStructureGuide ? '▲ إخفاء الشرح' : '▼ فتح الشرح'}
                </span>
              </button>
              {showLessonsStructureGuide && (
                <div className="p-4 space-y-3 border-t border-emerald-100 text-xs animate-in fade-in duration-200">
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    في ورقة <strong>الدروس</strong>، يمثل كل صف درساً مستقلاً يبدأ في <strong>العامود A (موضوع الدرس)</strong>، وتتتابع تمارين الكلمات والنصوص أفقياً في نفس الصف؛ كل تمرين يأخذ 8 أعمدة:
                  </p>
                  
                  <div className="space-y-2 text-xs">
                    {/* Exercise 1 */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[11px] font-bold text-emerald-800 block mb-1">
                        🔹 التمرين الأول (الأعمدة B إلى I):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-1.5 text-[10px] text-center font-semibold">
                        <span className="bg-white p-1.5 rounded-lg border border-slate-200"><b>B</b>: الفئة</span>
                        <span className="bg-white p-1.5 rounded-lg border border-slate-200"><b>C</b>: الصورة</span>
                        <span className="bg-white p-1.5 rounded-lg border border-slate-200"><b>D</b>: الصوت</span>
                        <span className="bg-white p-1.5 rounded-lg border border-slate-200"><b>E</b>: قراءة آلية</span>
                        <span className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-300 text-emerald-900"><b>F</b>: نص الدرس</span>
                        <span className="bg-white p-1.5 rounded-lg border border-slate-200"><b>G</b>: المعنى</span>
                        <span className="bg-white p-1.5 rounded-lg border border-slate-200"><b>H</b>: المخرج</span>
                        <span className="bg-amber-50 p-1.5 rounded-lg border border-amber-300 text-amber-900"><b>I</b>: التكرار</span>
                      </div>
                    </div>

                    {/* Exercise 2 */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[11px] font-bold text-indigo-800 block mb-1">
                        🔹 التمرين الثاني (الأعمدة J إلى Q):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-1.5 text-[10px] text-center font-semibold">
                        <span className="bg-white p-1.5 rounded-lg border border-slate-200"><b>J</b>: الفئة</span>
                        <span className="bg-white p-1.5 rounded-lg border border-slate-200"><b>K</b>: الصورة</span>
                        <span className="bg-white p-1.5 rounded-lg border border-slate-200"><b>L</b>: الصوت</span>
                        <span className="bg-white p-1.5 rounded-lg border border-slate-200"><b>M</b>: قراءة آلية</span>
                        <span className="bg-indigo-50 p-1.5 rounded-lg border border-indigo-300 text-indigo-900"><b>N</b>: نص الدرس</span>
                        <span className="bg-white p-1.5 rounded-lg border border-slate-200"><b>O</b>: المعنى</span>
                        <span className="bg-white p-1.5 rounded-lg border border-slate-200"><b>P</b>: المخرج</span>
                        <span className="bg-amber-50 p-1.5 rounded-lg border border-amber-300 text-amber-900"><b>Q</b>: التكرار</span>
                      </div>
                    </div>

                    {/* Exercise 3 & Beyond */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-emerald-200 text-[11px] text-slate-700 font-semibold flex items-center justify-between">
                      <span>🔹 التمرين الثالث (الأعمدة <b>R:Y</b>) | التمرين الرابع (<b>Z:AG</b>)... وهكذا بلا حدود</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold">
                        8 أعمدة لكل نص
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 2: Structure of sheet "answers 1" Guide Card */}
            <div className="border border-teal-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
              <button
                type="button"
                onClick={() => setShowAnswersStructureGuide(!showAnswersStructureGuide)}
                className="w-full p-4 bg-teal-50/70 hover:bg-teal-100/60 flex items-center justify-between transition-colors text-right cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-teal-700" />
                  <span className="text-xs font-bold text-teal-950">
                    📊 هيكل ورقة (answers 1) المعتمد لإجابات ودرجات الطلاب (النظام الأفقي)
                  </span>
                </div>
                <span className="text-xs font-bold text-teal-700 font-mono">
                  {showAnswersStructureGuide ? '▲ إخفاء الشرح' : '▼ فتح الشرح'}
                </span>
              </button>
              {showAnswersStructureGuide && (
                <div className="p-4 space-y-3 border-t border-teal-100 text-xs animate-in fade-in duration-200">
                  <p className="text-xs text-teal-900 leading-relaxed">
                    في ورقة <strong>answers 1</strong>، يُسجل لكل مشترك صف مستقل لكل درس يضم بياناته الأساسية (الأعمدة A إلى E)، ثم تُسجل إجابات التمارين أفقياً في نفس الصف؛ كل تمرين يأخذ 5 أعمدة:
                  </p>
                  
                  <div className="space-y-2 text-xs">
                    {/* Basic Columns A:E */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-teal-200">
                      <span className="text-[11px] font-bold text-slate-800 block mb-1">
                        🔹 الأعمدة الأساسية (A إلى E):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[10px] text-center font-semibold">
                        <span className="bg-white p-1.5 rounded-lg border border-slate-200"><b>A</b>: وقت الارسال</span>
                        <span className="bg-teal-50 p-1.5 rounded-lg border border-teal-300 text-teal-950"><b>B</b>: ID المشترك</span>
                        <span className="bg-teal-50 p-1.5 rounded-lg border border-teal-300 text-teal-950"><b>C</b>: اسم المشترك</span>
                        <span className="bg-white p-1.5 rounded-lg border border-slate-200"><b>D</b>: موضوع الدرس</span>
                        <span className="bg-white p-1.5 rounded-lg border border-slate-200 text-slate-400"><b>E</b>: (حالة الإنجاز)</span>
                      </div>
                    </div>

                    {/* Exercise 1 Columns F:J */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-teal-200">
                      <span className="text-[11px] font-bold text-teal-800 block mb-1">
                        🔹 الإجابة الأولى (الأعمدة F إلى J):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[10px] text-center font-semibold">
                        <span className="bg-white p-1.5 rounded-lg border border-slate-200"><b>F</b>: الكلمة المستهدفة</span>
                        <span className="bg-white p-1.5 rounded-lg border border-slate-200"><b>G</b>: النص المنطوق</span>
                        <span className="bg-white p-1.5 rounded-lg border border-slate-200"><b>H</b>: رابط ملف الصوت</span>
                        <span className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-300 text-emerald-900"><b>I</b>: الدرجة (%)</span>
                        <span className="bg-white p-1.5 rounded-lg border border-slate-200"><b>J</b>: التقدير</span>
                      </div>
                    </div>

                    {/* Exercise 2 & Beyond */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-teal-200 text-[11px] text-slate-700 font-semibold flex items-center justify-between">
                      <span>🔹 الإجابة الثانية (الأعمدة <b>K:O</b>) | الإجابة الثالثة (<b>P:T</b>)... وهكذا لكل تمرين 5 أعمدة في نفس الصف!</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 3: Setup Instructions & Apps Script Code */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
              <button
                type="button"
                onClick={() => setShowScriptCodeGuide(!showScriptCodeGuide)}
                className="w-full p-4 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between transition-colors text-right cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-900">
                    💻 كود Google Apps Script المحدث (يدعم ورقة الدروس ومجلد Google Drive و answers 1)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-indigo-600 font-mono">
                    {showScriptCodeGuide ? '▲ إخفاء الكود' : '▼ فتح الكود'}
                  </span>
                </div>
              </button>

              {showScriptCodeGuide && (
                <div className="p-5 space-y-3 border-t border-slate-200 text-xs animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">انسخ الكود والصقه في Apps Script بملف Google Sheets:</span>
                    <button
                      type="button"
                      onClick={handleCopyScriptCode}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">تم نسخ الكود!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ الكود الكامل</span>
                        </>
                      )}
                    </button>
                  </div>

                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 leading-relaxed pr-1">
                    <li>افتح جدول Google Sheets الخاص بك وأنشئ ورقة باسم: <strong>الدروس</strong>.</li>
                    <li>من القائمة العلوية: اضغط على <strong>التطبيقات الملحقة (Extensions)</strong> ثم <strong>Apps Script</strong>.</li>
                    <li>امسح ما بداخل الملف والصق الكود الذي نسخته بالزر أعلاه.</li>
                    <li>اضغط على الزر الأزرق بالأعلى: <strong>نشر (Deploy)</strong> ثم <strong>نشر جديد (New deployment)</strong>.</li>
                    <li>اختر النوع: <strong>تطبيق ويب (Web app)</strong>، واجعل صلاحية الوصول: <strong>أي شخص (Anyone)</strong>.</li>
                    <li>انسخ رابط تطبيق الويب والصقه في خانة الرابط أعلاه ثم اضغط "تأكيد الاتصال"!</li>
                  </ol>

                  <div className="relative mt-2">
                    <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 dir-ltr text-left">
                      {GOOGLE_APPS_SCRIPT_TEMPLATE}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: SUBMISSIONS LOG (LIVE FROM ANSWERS 1) */}
        {activeTab === 'submissions' && (
          <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-100 flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                  <Table className="w-5 h-5 text-teal-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    سجل نتائج واستجابات الطلاب المباشر من ورقة (answers 1)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    قراءة حية للنتائج والدرجات المحفوظة أفقياً في ورقة Google Sheets
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadAnswers1}
                  disabled={loadingAnswers1}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAnswers1 ? 'animate-spin' : ''}`} />
                  <span>{loadingAnswers1 ? 'جاري التحديث...' : 'تحديث من الشيت'}</span>
                </button>
                <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold font-mono">
                  {answers1Submissions.length} صفوف مسجلة
                </span>
              </div>
            </div>

            {/* Search Bar in Submissions Table */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={submissionsSearch}
                  onChange={(e) => setSubmissionsSearch(e.target.value)}
                  placeholder="بحث برقم المشترك، اسم الطالب، أو موضوع الدرس..."
                  className="w-full pr-9 pl-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 text-right"
                />
              </div>
              {submissionsSearch && (
                <button
                  type="button"
                  onClick={() => setSubmissionsSearch('')}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  مسح البحث
                </button>
              )}
            </div>

            {loadingAnswers1 ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
                <span>جاري قراءة البيانات المباشرة من ورقة answers 1...</span>
              </div>
            ) : answers1Submissions.length === 0 ? (
              <div className="text-center py-16 text-xs text-slate-400 space-y-2">
                <p>لم يتم العثور على أي نتائج مسجلة حتى الآن في ورقة answers 1.</p>
                <p className="text-[11px] text-slate-400">
                  عندما يتدرب الطلاب ويُعتمد إرسال التمارين، ستُسجل أفقياً في الشيت وتظهر هنا مباشرة.
                </p>
                <button
                  type="button"
                  onClick={handleLoadAnswers1}
                  className="mt-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  إعادة المحاولة
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="p-3">رقم المشترك</th>
                      <th className="p-3">اسم المشترك</th>
                      <th className="p-3">موضوع الدرس</th>
                      <th className="p-3 text-center">عدد التمارين</th>
                      <th className="p-3 text-center">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {answers1Submissions
                      .filter((row) => {
                        if (!submissionsSearch.trim()) return true;
                        const q = submissionsSearch.trim().toLowerCase();
                        const idMatch = row.studentId && row.studentId.toLowerCase().includes(q);
                        const nameMatch = row.studentName && row.studentName.toLowerCase().includes(q);
                        const subjMatch = row.lessonSubject && row.lessonSubject.toLowerCase().includes(q);
                        return idMatch || nameMatch || subjMatch;
                      })
                      .map((row, idx) => (
                        <tr key={idx} className="hover:bg-teal-50/40 transition-colors">
                          <td className="p-3 font-mono font-bold text-teal-900">
                            {row.studentId ? `#${row.studentId}` : '—'}
                          </td>
                          <td className="p-3 font-bold text-slate-900">
                            {row.studentName || 'مشترك'}
                          </td>
                          <td className="p-3 text-slate-700 font-semibold">
                            {row.lessonSubject || 'عام'}
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2.5 py-1 bg-teal-100 text-teal-800 rounded-full font-bold text-[11px]">
                              {row.totalExercises} تمارين
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedSubmissionDetail(row)}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <span>عرض تفاصيل الإجابات</span>
                              <span>👁️</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: TRANSLATION MANAGEMENT */}
        {activeTab === 'translations' && (
          <TranslationManager
            translations={translations || []}
            onSaveTranslations={onUpdateTranslations || (() => {})}
            geminiApiKey={geminiApiKey}
            webhookUrl={sheetsConfig.webhookUrl}
            curriculum={curriculum}
            onRefreshFromSheets={onRefreshFromSheets}
          />
        )}

      {/* MODAL: SUBMISSION EXERCISES DETAIL MODAL (answers 1) */}
      {selectedSubmissionDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setSelectedSubmissionDetail(null)}
              className="absolute left-5 top-5 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header info */}
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                <Table className="w-5 h-5 text-teal-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  تفاصيل إجابات المشترك: {selectedSubmissionDetail.studentName} ({selectedSubmissionDetail.studentId ? `#${selectedSubmissionDetail.studentId}` : ''})
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-semibold text-teal-900">درس: {selectedSubmissionDetail.lessonSubject}</span>
                  <span>•</span>
                  <span>{selectedSubmissionDetail.timestamp}</span>
                  <span>•</span>
                  <span>{selectedSubmissionDetail.exercises.length} تمرين مسجل</span>
                </div>
              </div>
            </div>

            {/* Exercises Grid */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {selectedSubmissionDetail.exercises.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400">
                  لا توجد تفاصيل تمارين في هذا السجل
                </div>
              ) : (
                selectedSubmissionDetail.exercises.map((ex, exIdx) => (
                  <div
                    key={exIdx}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">
                        تمرين رقم #{exIdx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                            ex.score >= 85
                              ? 'bg-emerald-100 text-emerald-800'
                              : ex.score >= 70
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          الدرجة: {ex.score}%
                        </span>
                        {ex.grade && (
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md font-bold text-[11px]">
                            {ex.grade}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-0.5">الكلمة المستهدفة:</span>
                        <span className="font-amiri text-lg font-bold text-emerald-800">
                          {ex.word}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-0.5">ما نطق به المشترك:</span>
                        <span className="font-amiri text-base font-semibold text-slate-700">
                          {ex.spokenText || '—'}
                        </span>
                      </div>
                    </div>

                    {/* Audio Player */}
                    {ex.audioUrl ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                        <div className="flex items-center gap-2 flex-1">
                          <Volume2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <audio
                            controls
                            src={getDirectAudioUrl(ex.audioUrl)}
                            className="h-8 w-full max-w-xs"
                          />
                        </div>
                        <a
                          href={ex.audioUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 shrink-0"
                        >
                          <span>فتح الملف في Google Drive</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic pt-1">
                        لا يوجد رابط تسجيل صوتي مرفوع
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSubmissionDetail(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
      </main>

      {/* MODAL 1: SUBJECTS MANAGER (تعديل وحذف وإضافة مواضيع الدروس) */}
      {showSubjectManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative max-h-[85vh] flex flex-col">
            <button
              onClick={() => setShowSubjectManager(false)}
              className="absolute left-5 top-5 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">إدارة مواضيع الدروس</h3>
                <p className="text-[11px] text-slate-400">تعديل الاسم أو حذف الدرس بالكامل</p>
              </div>
            </div>

            {/* Add new subject input */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newSubjInput}
                onChange={(e) => setNewSubjInput(e.target.value)}
                placeholder="اسم درس جديد..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (newSubjInput.trim()) {
                    onAddSubject(newSubjInput.trim());
                    setNewSubjInput('');
                  }
                }}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                + إضافة
              </button>
            </div>

            {/* Subjects List with Rename and Delete */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {subjects.map((subj) => {
                const count = curriculum.filter((c) => c.lessonSubject === subj).length;
                const isEditing = editingSubjName?.old === subj;

                return (
                  <div
                    key={subj}
                    className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-2"
                  >
                    {isEditing ? (
                      <div className="flex-1 flex gap-1.5">
                        <input
                          type="text"
                          value={editingSubjName.new}
                          onChange={(e) =>
                            setEditingSubjName({ ...editingSubjName, new: e.target.value })
                          }
                          className="flex-1 px-2 py-1 bg-white border border-emerald-400 rounded-lg text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (editingSubjName.new.trim()) {
                              onRenameSubject(editingSubjName.old, editingSubjName.new.trim());
                              setEditingSubjName(null);
                            }
                          }}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          حفظ
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSubjName(null)}
                          className="px-2 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="text-xs font-bold text-slate-800">{subj}</div>
                          <div className="text-[10px] text-slate-400">({count} كلمات)</div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingSubjName({ old: subj, new: subj })}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                            title="تعديل الاسم"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                confirm(
                                  `هل أنت متأكد من حذف درس "${subj}"؟ سيتم حذف جميع كلماته التابعة له (${count} كلمات).`
                                )
                              ) {
                                onDeleteSubject(subj);
                              }
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="حذف الدرس بالكامل"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CATEGORIES MANAGER (تعديل وحذف وإضافة الفئات) */}
      {showCategoryManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative max-h-[85vh] flex flex-col">
            <button
              onClick={() => setShowCategoryManager(false)}
              className="absolute left-5 top-5 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">إدارة الفئات</h3>
                <p className="text-[11px] text-slate-400">تعديل الاسم أو حذف الفئة</p>
              </div>
            </div>

            {/* Add new category input */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                placeholder="اسم فئة جديدة..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (newCatInput.trim()) {
                    onAddCategory(newCatInput.trim());
                    setNewCatInput('');
                  }
                }}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                + إضافة
              </button>
            </div>

            {/* Categories List with Rename and Delete */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {categories.map((cat) => {
                const count = curriculum.filter((c) => c.category === cat).length;
                const isEditing = editingCatName?.old === cat;

                return (
                  <div
                    key={cat}
                    className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-2"
                  >
                    {isEditing ? (
                      <div className="flex-1 flex gap-1.5">
                        <input
                          type="text"
                          value={editingCatName.new}
                          onChange={(e) =>
                            setEditingCatName({ ...editingCatName, new: e.target.value })
                          }
                          className="flex-1 px-2 py-1 bg-white border border-indigo-400 rounded-lg text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (editingCatName.new.trim()) {
                              onRenameCategory(editingCatName.old, editingCatName.new.trim());
                              setEditingCatName(null);
                            }
                          }}
                          className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          حفظ
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCatName(null)}
                          className="px-2 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="text-xs font-bold text-slate-800">{cat}</div>
                          <div className="text-[10px] text-slate-400">({count} كلمات)</div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingCatName({ old: cat, new: cat })}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                            title="تعديل الاسم"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من حذف فئة "${cat}"؟`)) {
                                onDeleteCategory(cat);
                              }
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="حذف الفئة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Sync & GitHub Deployment Guide Modal */}
      {showSyncGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowSyncGuideModal(false)}
              className="absolute left-5 top-5 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
              <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  دليل نشر الدروس ومزامنتها على GitHub و Vercel
                </h3>
                <p className="text-xs text-slate-500">
                  خطوات سريعة وسهلة لظهور كل الدروس الجديدة على هواتف الطلاب وأجهزتهم اللوحية
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="p-4 bg-amber-50 border border-amber-200/90 rounded-2xl">
                <h4 className="font-bold text-amber-900 mb-1 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>لماذا لم تظهر الدروس المضافة على الجوال والتابليت؟</span>
                </h4>
                <p className="text-amber-800 text-[11px] leading-relaxed">
                  عندما تضيف درساً جديداً، يحفظه المتصفح مؤقتاً في ذاكرته المحلية (Local Storage) الخاصة بحاسوبك الحالي فقط. الأجهزة الأخرى (الجوالات والأجهزة اللوحية) تتصل بـ Vercel وتقرأ كود المشروع الأساسي المخزن في ملف: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">src/data/arabicCurriculum.ts</code>.
                </p>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200/90 rounded-2xl space-y-2">
                <h4 className="font-bold text-emerald-950 flex items-center gap-1.5 text-sm">
                  <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>الحل الأسهل (بنقرة زر داخل AI Studio):</span>
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-emerald-900">
                  <li>
                    اضغط على الزر الأخضر في أعلى لوحة الإدارة: <strong>"حفظ في ملفات المشروع"</strong>.
                  </li>
                  <li>
                    سيقوم النظام بحفظ كل الكلمات والدروس والفئات التي أضفتها مباشرة في ملف <code className="bg-white px-1 rounded font-mono">src/data/arabicCurriculum.ts</code>.
                  </li>
                  <li>
                    قم بتصدير الملفات كالمعتاد ورفعها لمستودع GitHub؛ سيقوم Vercel بنشرها فوراً لكل الطلاب في ثوانٍ!
                  </li>
                </ol>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>الحل اليدوي المباشر على موقع GitHub (في 60 ثانية):</span>
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600">
                  <li>
                    اضغط زر <strong>"تحميل ملف المنهج (.ts)"</strong> أو <strong>"نسخ الكود"</strong> من شريط الإدارة.
                  </li>
                  <li>
                    ادخل إلى مستودعك في GitHub، ثم ادخل إلى المجلد: <code className="bg-slate-200/80 px-1 rounded font-mono">src</code> ثم <code className="bg-slate-200/80 px-1 rounded font-mono">data</code>.
                  </li>
                  <li>
                    اختر ملف <code className="bg-slate-200/80 px-1 rounded font-mono font-bold">arabicCurriculum.ts</code> واضغط على علامة القلم ✏️ لتعديله، ثم الصق الكود المنسوخ بالكامل بدلاً منه.
                  </li>
                  <li>
                    اضغط على الزر الأخضر أسفل الصفحة <strong>Commit changes</strong>.
                  </li>
                  <li>
                    انتهى الأمر! سيعيد Vercel البناء وستظهر جميع الدروس والفئات فوراً لجميع أجهزة الجوال والتابليت.
                  </li>
                </ol>
              </div>

              <div className="p-4 bg-indigo-50 border border-indigo-200/90 rounded-2xl space-y-1.5">
                <h4 className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>حل مشكلة الصوت والصور في Vercel:</span>
                </h4>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-indigo-900">
                  <li>
                    <strong>لقوقل درايف (Google Drive):</strong> تأكد أن إذن المشاركة لكل ملف صوت أو صورة مضبوط على <strong>"أي شخص لديه الرابط يمكنه العرض" (Anyone with link)</strong>. لقد قمنا بتحديث معالج الروابط ليستخدم خوادم Google CDN المباشرة (lh3) ليعمل الصوت على كل الجوالات وسفاري وكروم.
                  </li>
                  <li>
                    <strong>الخيار الأكثر ثباتاً وسرعة (مستودع GitHub نفسه):</strong> يمكنك حفظ ملفات الـ mp3 مباشرة في مجلد <code className="bg-white px-1 rounded font-mono">public/audio/</code> داخل المشروع، ووضع الرابط مثل: <code className="bg-white px-1 rounded font-mono">/audio/word1.mp3</code> حيث سيعمل بسرعة 100% بدون أي حظر أو تعقيدات.
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSyncGuideModal(false)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                فهمت، إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instant QR & URL Sync Modal for Mobile / Tablet */}
      {showQrSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowQrSyncModal(false)}
              className="absolute left-5 top-5 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  مزامنة الدروس للجوال والتابليت فوراً
                </h3>
                <p className="text-xs text-slate-500">
                  انقل جميع الدروس والكلمات الجديدة ({curriculum.length} كلمة) مباشرة لهاتفك
                </p>
              </div>
            </div>

            {/* QR Code Presentation */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-center mb-4">
              <div className="bg-white p-3 rounded-2xl inline-block border-2 border-amber-200 shadow-sm mb-3 min-w-[200px] min-h-[200px]">
                {qrLoading ? (
                  <div className="w-48 h-48 sm:w-56 sm:h-56 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                    <span className="text-xs">جاري إنشاء رمز QR محلياً...</span>
                  </div>
                ) : qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR Code"
                    className="w-48 h-48 sm:w-56 sm:h-56 mx-auto object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400">
                    اضغط لإنشاء رمز QR
                  </div>
                )}
              </div>

              <div className="space-y-1 text-xs text-slate-700">
                <p className="font-bold text-slate-900 flex items-center justify-center gap-1.5">
                  <span>📱 وجّه كاميرا الجوال نحو رمز الاستجابة السريعة (QR)</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  أو انسخ الرابط المباشر وأرسله في واتساب/تليجرام لفتحه على الجوال
                </p>
              </div>

              {/* Copy Direct Sync URL Button */}
              <div className="mt-3.5 flex gap-2">
                <button
                  type="button"
                  onClick={handleCopySyncUrl}
                  className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  {copiedSyncUrl ? (
                    <>
                      <CheckCheck className="w-4 h-4 text-slate-950" />
                      <span>تم نسخ رابط المزامنة للجوال!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-950" />
                      <span>نسخ رابط المزامنة المباشر للجوال</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Important Info: Permanent GitHub / Vercel Baking */}
            <div className="p-4 bg-emerald-50 border border-emerald-200/90 rounded-2xl text-xs text-emerald-950 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>لتثبيت الدروس نهائياً لجميع الزوار على Vercel:</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                رمز QR والرابط يقوم بنقل الدروس لجهازك فوراً. ولكن لجعل الدروس الجديدة هي الافتراضية لأي طالب يفتح الموقع من أي مكان:
              </p>
              <ol className="list-decimal list-inside text-[11px] text-emerald-900 space-y-1 pr-1 font-medium">
                <li>اضغط على زر <strong>"تحميل ملف المنهج (.ts)"</strong> من الشريط العلوي.</li>
                <li>استبدل الملف في مشروعك بمجلد: <code className="bg-white/80 px-1 py-0.5 rounded font-mono">src/data/arabicCurriculum.ts</code>.</li>
                <li>ارفع التعديل إلى مستودع GitHub (git push) وسيقوم Vercel بنشره لجميع الهواتف تلقائياً!</li>
              </ol>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowQrSyncModal(false)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GOOGLE CLOUD BILLING & UPGRADE GUIDE */}
      {showBillingGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto font-cairo">
            <button
              onClick={() => setShowBillingGuideModal(false)}
              className="absolute left-5 top-5 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 shadow-xs border border-amber-200">
                <CreditCard className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  دليل الترقية والدفع وتفعيل الباقة المفتوحة (Google Cloud Billing)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  خطوات رسمية لربط البطاقة البنكية وتفعيل الدفع حسب الاستهلاك مع ميزة الحماية والحد المالي
                </p>
              </div>
            </div>

            {/* Official Links Box */}
            <div className="p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-950">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-bold">الموقع الرسمي لإدارة الفوترة والبطاقات:</span>
              </div>
              <div className="flex gap-2">
                <a
                  href="https://console.cloud.google.com/billing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                >
                  <span>Google Cloud Billing</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href="https://aistudio.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                >
                  <span>Google AI Studio</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* 5 Detailed Steps */}
            <div className="space-y-4 mb-6">
              <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">1</span>
                  <span>الخطوة الأولى: فتح حساب الفوترة وإضافة البطاقة</span>
                </div>
                <p className="text-xs text-slate-600 pr-8 leading-relaxed">
                  ادخل إلى رابط <a href="https://console.cloud.google.com/billing" target="_blank" rel="noreferrer" className="text-indigo-600 font-bold underline">Google Cloud Billing</a> وسجّل الدخول بحساب Google نفسه. اضغط على <strong>"Add Billing Account"</strong> وأدخل بيانات بطاقتك البنكية (Visa أو MasterCard أو Mada).
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-amber-200/80 bg-amber-50/60 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
                  <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs">2</span>
                  <span>الخطوة الثانية: تعيين الحد المالي للحماية (Budget Alert) - هام جداً!</span>
                </div>
                <p className="text-xs text-amber-900 pr-8 leading-relaxed">
                  من القائمة الجانبية في Billing، اختر <strong>"Budgets & alerts"</strong> ثم <strong>"Create Budget"</strong>. حدد حداً مالياً آمناً (مثلاً: <strong>5 دولار شهرياً</strong> أو 20 ريال). بهذه الطريقة تضمن بنسبة 100% أن جوجل لن تسحب أي مبالغ إضافية وسيرسل لك إشعاراً فورياً.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">3</span>
                  <span>الخطوة الثالثة: الحصول على مفتاح API</span>
                </div>
                <p className="text-xs text-slate-600 pr-8 leading-relaxed">
                  افتح موقع <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-indigo-600 font-bold underline">Google AI Studio</a>، واضغط على <strong>"Get API key"</strong> بالأعلى. اختر مشروعك المربوط بالفوترة وانسخ المفتاح السري الناتج.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">4</span>
                  <span>الخطوة الرابعة: تفعيل المفتاح في موقع Vercel</span>
                </div>
                <p className="text-xs text-slate-600 pr-8 leading-relaxed">
                  ادخل إلى لوحة تحكم موقعك على Vercel، ثم اذهب إلى: <code className="bg-white px-1.5 py-0.5 rounded font-mono text-slate-800">Settings &rarr; Environment Variables</code>. أضف متغيراً جديداً باسم <code className="font-mono font-bold text-indigo-700 bg-white px-1 rounded">GEMINI_API_KEY</code> وضع قيمته هي المفتاح الذي نسخته، ثم اضغط <strong>Save</strong>.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">5</span>
                  <span>الخطوة الخامسة: التشغيل الفوري المباشر (Zero Downtime)</span>
                </div>
                <p className="text-xs text-emerald-900 pr-8 leading-relaxed">
                  بمجرد إتمام الخطوات أعلاه، سيعمل النظام فورياً لجميع الطلاب دون أي توقف أو حاجة لتعديل الكود البرمجي، ويمكنك من شريط الاستهلاك بالأعلى رفع الحد اليومي إلى أي رقم تريده (مثلاً 5000 أو 10000 محاولة).
                </p>
              </div>
            </div>

            {/* Pricing transparency */}
            <div className="p-4 bg-slate-100 rounded-2xl text-xs text-slate-600 space-y-1 mb-6">
              <div className="font-bold text-slate-800">💡 معلومات التكلفة للموديل (Gemini Flash):</div>
              <p>• الباقة المجانية: تمنحك <strong>1,500 محاولة يومياً مجاناً 100%</strong> وتتجدد تلقائياً كل ليلة في منتصف الليل.</p>
              <p>• في حالة الاستهلاك الإضافي المدفوع: التكلفة ضئيلة جداً (كل 1,000 نطق صوتي تكلفته حوالي <strong>0.05 دولار</strong> فقط أي 20 هللة تقريباً).</p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBillingGuideModal(false)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إغلاق الدليل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED VOICE RECORDING & GOOGLE DRIVE MODAL (Issue 3) */}
      {showVoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 text-right space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">تسجيل صوت الشرح ورفعه إلى Google Drive</h3>
                  <p className="text-xs text-slate-500">معاينة الصوت قبل الرفع وحفظ الرابط المباشر في الشيت</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isRecordingVoiceModal) handleStopVoiceModalRecording();
                  setShowVoiceModal(false);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Context Info */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">الكلمة / النص المستهدف:</span>
                <span className="font-amiri text-lg font-bold text-slate-900">{wordText || 'تمرين جديد'}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5">
                <span className="text-slate-500">موضوع الدرس:</span>
                <span className="font-bold text-emerald-800">{lessonSubject}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5">
                <span className="text-slate-500">مجلد الحفظ في Google Drive:</span>
                <span className="font-mono text-[11px] text-slate-700 font-semibold">{sheetsConfig.driveFolderId || DEFAULT_DRIVE_AUDIO_FOLDER_ID}</span>
              </div>
            </div>

            {/* Custom Voice File Name Field (اسم الملف الصوتي مع التاريخ) */}
            <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-right">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>اسم الملف الصوتي للمعلم (اختياري):</span>
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">يُضاف التاريخ تلقائياً</span>
              </label>
              <input
                type="text"
                value={customVoiceFileName}
                onChange={(e) => setCustomVoiceFileName(e.target.value)}
                placeholder={wordText.trim() ? `مثال: شرح_${wordText.trim()}` : "مثال: شرح_الدرس_الأول"}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500 transition-colors"
              />
              <p className="text-[10px] text-slate-500 leading-relaxed">
                سيُحفظ الملف في Google Drive بالاسم المكتوب مع تاريخ وتوقيت الرفع تلقائياً: <span className="font-mono text-emerald-800 dir-ltr inline-block font-bold">{(customVoiceFileName.trim() || wordText.trim() || "شرح") + "_YYYY-MM-DD_HH-mm.mp3"}</span>
              </p>
            </div>

            {/* Step 1 & 2: Recording Controls */}
            {!modalAudioBlobUrl ? (
              <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-4">
                {isRecordingVoiceModal ? (
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-100 text-rose-700 text-sm font-bold animate-pulse">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                      <span>جاري تسجيل صوت المعلم: {String(Math.floor(voiceRecordSeconds / 60)).padStart(2, '0')}:{String(voiceRecordSeconds % 60).padStart(2, '0')}</span>
                    </div>
                    <p className="text-xs text-slate-500">تحدث بوضوح بالقرب من الميكروفون لشرح الكلمة ومخارج حروفها...</p>
                    <button
                      type="button"
                      onClick={handleStopVoiceModalRecording}
                      className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-rose-600/30 flex items-center justify-center gap-2 mx-auto cursor-pointer"
                    >
                      <MicOff className="w-4 h-4" />
                      <span>إيقاف التسجيل وإنهاء</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                      <Mic className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">جاهز لبدء التسجيل الصوتي</h4>
                      <p className="text-xs text-slate-500 mt-1">انقر أدناه لبدء تسجيل صوتك. يمكنك التحدث لشرح الكلمة أو نطقها بالطريقة الصحيحة.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleStartVoiceModalRecording}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 mx-auto cursor-pointer"
                    >
                      <Mic className="w-4 h-4" />
                      <span>بدء تسجيل صوت المعلم</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Step 3: Audio Preview & Save to Drive */
              <div className="p-5 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>تم تسجيل الصوت بنجاح! استمع للمعاينة:</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleResetVoiceModalRecording}
                    className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>إعادة التسجيل</span>
                  </button>
                </div>

                {/* Audio Player for immediate preview */}
                <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs">
                  <audio
                    src={modalAudioBlobUrl}
                    controls
                    className="w-full h-10 outline-hidden"
                  />
                </div>

                {/* Upload to Google Drive Action */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={handleUploadModalAudioToDrive}
                    disabled={isUploadingToDrive}
                    className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isUploadingToDrive ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري حفظ ورفع الملف إلى Google Drive...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>☁️ حفظ ورفع في Google Drive ومزامنة الرابط في الشيت</span>
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-slate-500 text-center">
                    سيتم حفظ الملف في مجلد Drive المعتمد وتوليد رابط مباشر يسجل في العامود D بورقة "الدروس".
                  </p>
                </div>
              </div>
            )}

            {/* Upload Result Feedback */}
            {driveUploadResult && (
              <div
                className={`p-3.5 rounded-2xl border text-xs font-semibold space-y-2 animate-in fade-in duration-200 ${
                  driveUploadResult.success
                    ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                    : 'bg-rose-50 text-rose-950 border-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {driveUploadResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{driveUploadResult.message}</span>
                </div>

                {driveUploadResult.url && (
                  <div className="bg-white/80 p-2 rounded-lg border border-emerald-200 font-mono text-[10px] dir-ltr text-left break-all select-all">
                    {driveUploadResult.url}
                  </div>
                )}

                {!driveUploadResult.success && (driveUploadResult.message.includes('permission') || driveUploadResult.message.includes('DriveApp') || driveUploadResult.message.includes('صلاحيات')) && (
                  <div className="bg-white/90 p-3 rounded-xl border border-rose-200 text-slate-700 text-[11px] space-y-2 mt-2">
                    <div className="font-bold text-rose-800 flex items-center gap-1.5">
                      <span>💡 حل سريع لتفعيل صلاحية Google Drive في الشيت:</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-slate-600 leading-relaxed pr-1">
                      <li>انسخ كود السكربت المحدث بالضغط على الزر أدناه.</li>
                      <li>في Google Sheets، افتح: <strong>ملحقات (Extensions) &larr; Apps Script</strong> والصق الكود.</li>
                      <li>من القائمة المنسدلة بالأعلى، اختر دالة: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700 font-bold">authorizePermissions</code> ثم اضغط <strong>تشغيل (Run)</strong>.</li>
                      <li>ستظهر نافذة تطلب منح الإذن لـ Google Drive: اضغط <strong>Review Permissions</strong> ثم <strong>Allow</strong>.</li>
                      <li>اضغط <strong>نشر (Deploy) &larr; إدارة عمليات النشر (Manage Deployments) &larr; تعديل &larr; New Version</strong>.</li>
                    </ol>
                    <button
                      type="button"
                      onClick={handleCopyScriptCode}
                      className="w-full py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span>📋 نسخ كود Google Apps Script المحدّث</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  if (isRecordingVoiceModal) handleStopVoiceModalRecording();
                  setShowVoiceModal(false);
                }}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {driveUploadResult?.success ? 'تم، العودة إلى الدرس' : 'إغلاق'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
