import React, { useEffect, useRef, useState } from 'react';
import { DictationExercise, DictationLessonSubject } from '../types';
import {
  saveDictationExerciseToSheets,
  fetchDictationExercisesFromSheets,
  exportAllDictationCurriculumToSheets,
  uploadAudioToDrive,
  DEFAULT_DRIVE_AUDIO_FOLDER_ID,
  DEFAULT_WEBHOOK_URL,
  STORAGE_KEY_DICTATION_CURRICULUM,
} from '../utils/googleSheets';
import {
  QuestionBlockType,
  parseQuestionBlocks,
  formatQuestionBlocks,
  getQuestionPlainText,
  getDirectImageUrl,
} from '../utils/matchingMedia';
import {
  detectDictationType,
  getDictationTypeLabel,
  parsePoolTokens,
  parseAnswerWithBlanks,
  generateScrambledFromAnswer,
  formatDictationSettingsString,
} from '../utils/dictationUtils';
import { getAlternativeAudioUrls } from '../utils/mediaUrl';
import {
  Plus,
  Trash2,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  List,
  Edit3,
  UploadCloud,
  X,
  Image as ImageIcon,
  Volume2,
  Mic,
  MicOff,
  RotateCcw,
  Upload,
  Play,
  Pause,
  ArrowUp,
  ArrowDown,
  FileText,
  Loader2,
  Wand2,
} from 'lucide-react';

interface DictationAdminManagerProps {
  subjects: DictationLessonSubject[];
  onUpdateSubjects: (subjects: DictationLessonSubject[]) => void;
  webhookUrl?: string;
  driveFolderId?: string;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const DictationAdminManager: React.FC<DictationAdminManagerProps> = ({
  subjects,
  onUpdateSubjects,
  webhookUrl,
  driveFolderId,
}) => {
  const [subTab, setSubTab] = useState<'add' | 'list'>('list');

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

  // Question builder state (Text + Image + Audio in custom order)
  const [questionOrder, setQuestionOrder] = useState<QuestionBlockType[]>(['text', 'image', 'audio']);
  const [qText, setQText] = useState<string>('');
  const [qImageUrl, setQImageUrl] = useState<string>('');
  const [qAudioUrl, setQAudioUrl] = useState<string>('');

  // Dictation core fields (Col C & Col D)
  const [correctAnswer, setCorrectAnswer] = useState<string>('');
  const [scrambledPool, setScrambledPool] = useState<string>('');
  const [durationSeconds, setDurationSeconds] = useState<number>(5);
  const [allowRetry, setAllowRetry] = useState<boolean>(true);

  const answerInputRef = useRef<HTMLInputElement | null>(null);

  const [statusMessage, setStatusMessage] = useState<{
    success: boolean;
    text: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Audio playback & lightbox preview
  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);
  const [previewLightboxUrl, setPreviewLightboxUrl] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Voice recording modal to Google Drive
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceRecordSeconds, setVoiceRecordSeconds] = useState(0);
  const [isRecordingVoiceModal, setIsRecordingVoiceModal] = useState(false);
  const [modalAudioBlobUrl, setModalAudioBlobUrl] = useState<string | null>(null);
  const [modalAudioBase64, setModalAudioBase64] = useState<string | null>(null);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveUploadResult, setDriveUploadResult] = useState<{
    success: boolean;
    url?: string;
    message: string;
  } | null>(null);
  const [customVoiceFileName, setCustomVoiceFileName] = useState('');

  const voiceModalRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceModalStreamRef = useRef<MediaStream | null>(null);
  const voiceModalChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<any>(null);

  const stopVoiceModalMicStream = () => {
    if (voiceModalStreamRef.current) {
      try {
        voiceModalStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      voiceModalStreamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      if (voiceModalRecorderRef.current && voiceModalRecorderRef.current.state !== 'inactive') {
        try {
          voiceModalRecorderRef.current.stop();
        } catch {}
      }
      stopVoiceModalMicStream();
      if (previewAudioRef.current) {
        try {
          previewAudioRef.current.pause();
        } catch {}
      }
    };
  }, []);

  const handlePlayPreviewAudio = (key: string, url: string) => {
    const clean = (url || '').trim();
    if (!clean) return;

    if (playingAudioKey === key && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setPlayingAudioKey(null);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }

    const candidates = getAlternativeAudioUrls(clean);
    if (candidates.length === 0) candidates.push(clean);

    setPlayingAudioKey(key);
    let idx = 0;
    const tryNext = () => {
      if (idx >= candidates.length) {
        setPlayingAudioKey(null);
        return;
      }
      const src = candidates[idx++];
      const audio = new Audio(src);
      previewAudioRef.current = audio;
      audio.onended = () => setPlayingAudioKey(null);
      audio.onerror = () => tryNext();
      audio.play().catch(() => tryNext());
    };
    tryNext();
  };

  const handleOpenVoiceModal = () => {
    if (modalAudioBlobUrl) URL.revokeObjectURL(modalAudioBlobUrl);
    setVoiceModalOpen(true);
    setVoiceRecordSeconds(0);
    setIsRecordingVoiceModal(false);
    setModalAudioBlobUrl(null);
    setModalAudioBase64(null);
    setDriveUploadResult(null);
    setCustomVoiceFileName(qText.trim().slice(0, 30) || 'صوت_إملاء');
  };

  const handleCloseVoiceModal = () => {
    if (voiceModalRecorderRef.current && voiceModalRecorderRef.current.state !== 'inactive') {
      try {
        voiceModalRecorderRef.current.stop();
      } catch {}
    }
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    stopVoiceModalMicStream();
    if (modalAudioBlobUrl) URL.revokeObjectURL(modalAudioBlobUrl);
    setIsRecordingVoiceModal(false);
    setModalAudioBlobUrl(null);
    setModalAudioBase64(null);
    setVoiceModalOpen(false);
  };

  const handleStartVoiceModalRecording = async () => {
    try {
      voiceModalChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceModalStreamRef.current = stream;
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
        setModalAudioBlobUrl(blobUrl);
        setModalAudioBase64(base64);
        stopVoiceModalMicStream();
        setIsRecordingVoiceModal(false);
        if (voiceTimerRef.current) {
          clearInterval(voiceTimerRef.current);
          voiceTimerRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecordingVoiceModal(true);
      setVoiceRecordSeconds(0);
      voiceTimerRef.current = setInterval(() => {
        setVoiceRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      alert('يرجى السماح بالوصول للميكروفون لبدء تسجيل صوت السؤال.');
    }
  };

  const handleStopVoiceModalRecording = () => {
    if (voiceModalRecorderRef.current && voiceModalRecorderRef.current.state !== 'inactive') {
      voiceModalRecorderRef.current.stop();
    }
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  };

  const handleResetVoiceModalRecording = () => {
    if (modalAudioBlobUrl) URL.revokeObjectURL(modalAudioBlobUrl);
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

    const effectiveWebhook = (webhookUrl || DEFAULT_WEBHOOK_URL).trim();
    const rawFolder = (driveFolderId || DEFAULT_DRIVE_AUDIO_FOLDER_ID || '').trim();
    const targetFolder = rawFolder || DEFAULT_DRIVE_AUDIO_FOLDER_ID;
    setIsUploadingToDrive(true);
    setDriveUploadResult(null);

    try {
      const finalAudioName = customVoiceFileName.trim() || qText.trim() || 'صوت_إملاء';
      const res = await uploadAudioToDrive(
        effectiveWebhook,
        modalAudioBase64,
        finalAudioName,
        targetFolder,
        customVoiceFileName.trim() || undefined
      );

      if (res.success && res.audioUrl) {
        setQAudioUrl(res.audioUrl);
        setDriveUploadResult({
          success: true,
          url: res.audioUrl,
          message: 'تم رفع الصوت إلى Google Drive بنجاح وإضافته لحقل السؤال!',
        });
      } else {
        setDriveUploadResult({
          success: false,
          message: res.message || 'فشل الرفع إلى Google Drive.',
        });
      }
    } catch {
      setDriveUploadResult({
        success: false,
        message: 'حدث خطأ أثناء الاتصال بخدمة Google Drive.',
      });
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleMoveQuestionBlock = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= questionOrder.length) return;
    setQuestionOrder((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  };

  // Helper button to wrap selected text inside Correct Answer input with |...|
  const handleMarkSelectionAsBlank = () => {
    const input = answerInputRef.current;
    if (!input) return;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;

    if (end > start) {
      const before = correctAnswer.slice(0, start);
      const selected = correctAnswer.slice(start, end);
      const after = correctAnswer.slice(end);
      const nextVal = `${before}|${selected}|${after}`;
      setCorrectAnswer(nextVal);
    } else {
      alert('ظلّل الحرف أو الكلمة داخل خانة الإجابة الصحيحة أولاً، ثم اضغط هذا الزر لجعله فراغاً ناقصاً |...|');
    }
  };

  const handleAutoGenerateScrambled = () => {
    if (!correctAnswer.trim()) {
      alert('أدخل الإجابة الصحيحة أولاً ليتم تفكيكها تلقائياً.');
      return;
    }
    const generated = generateScrambledFromAnswer(correctAnswer);
    setScrambledPool(generated);
  };

  const resetFormFields = () => {
    setQuestionOrder(['text', 'image', 'audio']);
    setQText('');
    setQImageUrl('');
    setQAudioUrl('');
    setCorrectAnswer('');
    setScrambledPool('');
    setDurationSeconds(5);
    setAllowRetry(true);
  };

  const handleStartEdit = (subj: DictationLessonSubject, ex: DictationExercise) => {
    setSelectedSubjectMode('existing');
    setExistingSubjectName(subj.subjectName);

    const blocks = parseQuestionBlocks(ex.questionText);
    const seenTypes: QuestionBlockType[] = [];
    let nextText = '';
    let nextImg = '';
    let nextAud = '';
    for (const b of blocks) {
      if (!seenTypes.includes(b.type)) seenTypes.push(b.type);
      if (b.type === 'text') nextText = nextText ? `${nextText} ${b.value}` : b.value;
      if (b.type === 'image' && !nextImg) nextImg = b.value;
      if (b.type === 'audio' && !nextAud) nextAud = b.value;
    }
    const allTypes: QuestionBlockType[] = ['text', 'image', 'audio'];
    setQuestionOrder([...seenTypes, ...allTypes.filter((t) => !seenTypes.includes(t))]);
    setQText(nextText);
    setQImageUrl(nextImg);
    setQAudioUrl(nextAud);
    setCorrectAnswer(ex.correctAnswer || '');
    setScrambledPool(ex.scrambledPool || '');
    setDurationSeconds(ex.durationSeconds || 5);
    setAllowRetry(ex.allowRetry !== false);
    setEditingInfo({
      subjectId: subj.id,
      exerciseId: ex.id,
      exerciseNumber: ex.exerciseNumber,
    });
    setSubTab('add');
    setStatusMessage({
      success: true,
      text: `أنت تقوم الآن بتعديل التمرين ${ex.exerciseNumber} في موضوع «${subj.subjectName}».`,
    });
  };

  const handleCancelEdit = () => {
    setEditingInfo(null);
    resetFormFields();
    setStatusMessage(null);
    setSubTab('list');
  };

  const buildFinalQuestionString = (): string => {
    const blocks = questionOrder
      .map((type) => {
        if (type === 'text') return { type, value: qText.trim() };
        if (type === 'image') return { type, value: qImageUrl.trim() };
        return { type, value: qAudioUrl.trim() };
      })
      .filter((b) => Boolean(b.value));
    return formatQuestionBlocks(blocks);
  };

  const handleSaveExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveSubject =
      selectedSubjectMode === 'new'
        ? newSubjectName.trim()
        : existingSubjectName.trim() || subjects[0]?.subjectName || 'تمارين إملاء عامة';

    if (!effectiveSubject) {
      alert('يرجى كتابة أو اختيار موضوع الدرس');
      return;
    }

    const finalQuestionString = buildFinalQuestionString();
    if (!finalQuestionString) {
      alert('يرجى إدخال عنصر واحد على الأقل في السؤال (نص، أو صورة، أو صوت)');
      return;
    }

    if (!correctAnswer.trim()) {
      alert('يرجى إدخال الإجابة الصحيحة في العمود المخصص.');
      return;
    }

    if (!scrambledPool.trim()) {
      alert('يرجى إدخال الحروف أو الكلمات المشتتة (أو الضغط على زر التفكيك التلقائي).');
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    const settingsString = formatDictationSettingsString({ durationSeconds, allowRetry });

    let nextSubjects: DictationLessonSubject[];
    let exerciseNumberToSave = 1;

    if (editingInfo) {
      exerciseNumberToSave = editingInfo.exerciseNumber;
      nextSubjects = subjects.map((s) => {
        if (s.id === editingInfo.subjectId) {
          return {
            ...s,
            exercises: s.exercises.map((ex) => {
              if (ex.id === editingInfo.exerciseId) {
                return {
                  ...ex,
                  questionText: finalQuestionString,
                  scrambledPool: scrambledPool.trim(),
                  correctAnswer: correctAnswer.trim(),
                  settingsString,
                  durationSeconds,
                  allowRetry,
                };
              }
              return ex;
            }),
          };
        }
        return s;
      });
    } else {
      const subjectItem = subjects.find((s) => s.subjectName === effectiveSubject);
      exerciseNumberToSave = subjectItem ? subjectItem.exercises.length + 1 : 1;

      const newExercise: DictationExercise = {
        id: `dict-ex-${Date.now()}`,
        exerciseNumber: exerciseNumberToSave,
        questionText: finalQuestionString,
        scrambledPool: scrambledPool.trim(),
        correctAnswer: correctAnswer.trim(),
        settingsString,
        durationSeconds,
        allowRetry,
      };

      if (subjectItem) {
        nextSubjects = subjects.map((s) =>
          s.id === subjectItem.id ? { ...s, exercises: [...s.exercises, newExercise] } : s
        );
      } else {
        nextSubjects = [
          ...subjects,
          {
            id: `dict-subj-${Date.now()}`,
            subjectName: effectiveSubject,
            exercises: [newExercise],
          },
        ];
      }
    }

    onUpdateSubjects(nextSubjects);
    try {
      localStorage.setItem(STORAGE_KEY_DICTATION_CURRICULUM, JSON.stringify(nextSubjects));
    } catch {}

    if (webhookUrl) {
      try {
        const sheetRes = await saveDictationExerciseToSheets(webhookUrl, {
          subjectName: effectiveSubject,
          exerciseNumber: exerciseNumberToSave,
          questionText: finalQuestionString,
          scrambledPool: scrambledPool.trim(),
          correctAnswer: correctAnswer.trim(),
          durationSeconds,
          allowRetry,
        });
        setStatusMessage({
          success: sheetRes.success,
          text: sheetRes.success
            ? editingInfo
              ? `تم تحديث التمرين ${exerciseNumberToSave} بنجاح في ورقة "كلمات"!`
              : 'تم حفظ التمرين الجديد بنجاح في ورقة "كلمات"!'
            : `تم الحفظ محلياً، وتعذر التحديث في الشيت: ${sheetRes.error || ''}`,
        });
      } catch {
        setStatusMessage({
          success: false,
          text: 'تم الحفظ محلياً في المتصفح فقط.',
        });
      }
    } else {
      setStatusMessage({
        success: true,
        text: 'تم الحفظ محلياً في المتصفح بنجاح!',
      });
    }

    setIsSaving(false);
    setEditingInfo(null);
    resetFormFields();
    if (selectedSubjectMode === 'new') {
      setSelectedSubjectMode('existing');
      setExistingSubjectName(effectiveSubject);
    }
  };

  const handleDeleteExercise = (subjectId: string, exerciseId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا التمرين؟')) return;

    const nextSubjects = subjects
      .map((subj) => {
        if (subj.id === subjectId) {
          const filtered = subj.exercises.filter((e) => e.id !== exerciseId);
          return {
            ...subj,
            exercises: filtered.map((e, idx) => ({ ...e, exerciseNumber: idx + 1 })),
          };
        }
        return subj;
      })
      .filter((subj) => subj.exercises.length > 0);

    onUpdateSubjects(nextSubjects);
    try {
      localStorage.setItem(STORAGE_KEY_DICTATION_CURRICULUM, JSON.stringify(nextSubjects));
    } catch {}
    setStatusMessage({
      success: true,
      text: 'تم حذف التمرين بنجاح من القائمة المحلية.',
    });
  };

  const handleRefreshFromSheet = async () => {
    if (!webhookUrl) {
      alert('يرجى ربط Google Sheets أولاً.');
      return;
    }
    setIsRefreshing(true);
    try {
      const res = await fetchDictationExercisesFromSheets(webhookUrl);
      if (res.success && res.subjects.length > 0) {
        onUpdateSubjects(res.subjects);
        setStatusMessage({
          success: true,
          text: `تم جلب ${res.subjects.length} مواضيع بنجاح من ورقة "كلمات"!`,
        });
      } else {
        setStatusMessage({
          success: false,
          text: 'لم يتم العثور على تمارين في ورقة "كلمات".',
        });
      }
    } catch {
      setStatusMessage({
        success: false,
        text: 'تعذر جلب التمارين من الشيت.',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportAllToSheets = async () => {
    if (!webhookUrl) {
      alert('يرجى إدخال رابط Webhook أولاً.');
      return;
    }
    if (!confirm('سيتم تصدير جميع تمارين الإملاء الحالية إلى ورقة (كلمات) في Google Sheets. هل تود المتابعة؟')) {
      return;
    }
    setIsExporting(true);
    setStatusMessage(null);
    try {
      const res = await exportAllDictationCurriculumToSheets(webhookUrl, subjects);
      setStatusMessage({ success: res.success, text: res.message });
    } catch {
      setStatusMessage({ success: false, text: 'حدث خطأ أثناء التصدير إلى ورقة كلمات.' });
    } finally {
      setIsExporting(false);
    }
  };

  const liveDetectedType = detectDictationType(scrambledPool, correctAnswer);
  const liveBlanks = parseAnswerWithBlanks(correctAnswer);
  const liveTilesPreview = parsePoolTokens(scrambledPool);

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/80 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-600" />
            <span>إدارة تمارين الإملاء وترتيب الكلمات (ورقة: كلمات)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            أضف تمارين ترتيب الحروف، ترتيب الكلمات، أو إكمال الناقص |...| مع حفظ تلقائي في ورقة «كلمات».
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportAllToSheets}
            disabled={isExporting || isRefreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <UploadCloud className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>{isExporting ? 'جاري التصدير...' : 'تصدير إلى ورقة (كلمات) 📤'}</span>
          </button>

          <button
            type="button"
            onClick={handleRefreshFromSheet}
            disabled={isRefreshing || isExporting}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>تحديث من الشيت (كلمات)</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
            statusMessage.success
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}
        >
          {statusMessage.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSubTab('list')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === 'list'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <List className="w-4 h-4" />
          <span>قائمة التمارين ({subjects.reduce((acc, s) => acc + s.exercises.length, 0)})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (editingInfo) {
              handleCancelEdit();
            }
            setSubTab('add');
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === 'add'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {editingInfo ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{editingInfo ? `تعديل تمرين ${editingInfo.exerciseNumber}` : 'إضافة تمرين جديد'}</span>
        </button>
      </div>

      {/* TAB 1: LIST */}
      {subTab === 'list' ? (
        <div className="space-y-4">
          {subjects.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              لا توجد تمارين إملاء مضافة بعد. اضغط «إضافة تمرين جديد».
            </div>
          ) : (
            subjects.map((subj) => (
              <div
                key={subj.id}
                className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    {subj.subjectName}{' '}
                    <span className="text-teal-700 font-bold text-xs">
                      ({subj.exercises.length} تمارين)
                    </span>
                  </h4>
                </div>

                <div className="space-y-2">
                  {subj.exercises.map((ex) => {
                    const qType = detectDictationType(ex.scrambledPool, ex.correctAnswer);
                    return (
                      <div
                        key={ex.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-lg bg-teal-100 text-teal-900 font-bold text-[11px]">
                              تمرين {ex.exerciseNumber}
                            </span>
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold text-[10px]">
                              {getDictationTypeLabel(qType)}
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm font-bold text-slate-900">
                            {getQuestionPlainText(ex.questionText)}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                            <span>
                              <strong className="text-slate-700">المشتت:</strong> {ex.scrambledPool}
                            </span>
                            <span>•</span>
                            <span>
                              <strong className="text-emerald-700">الإجابة:</strong> {ex.correctAnswer}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(subj, ex)}
                            className="p-2 bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 rounded-xl transition-colors cursor-pointer"
                            title="تعديل التمرين"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExercise(subj.id, ex.id)}
                            className="p-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl transition-colors cursor-pointer"
                            title="حذف التمرين"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* TAB 2: ADD / EDIT FORM */
        <form onSubmit={handleSaveExercise} className="space-y-5">
          {/* 1. Subject Selector */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <label className="block text-xs font-extrabold text-slate-700">
              1. موضوع الدرس (العمود A):
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedSubjectMode('existing')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  selectedSubjectMode === 'existing'
                    ? 'bg-teal-600 text-white'
                    : 'bg-white border border-slate-300 text-slate-600'
                }`}
              >
                اختيار موضوع حالي
              </button>
              <button
                type="button"
                onClick={() => setSelectedSubjectMode('new')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  selectedSubjectMode === 'new'
                    ? 'bg-teal-600 text-white'
                    : 'bg-white border border-slate-300 text-slate-600'
                }`}
              >
                إضافة موضوع جديد
              </button>
            </div>

            {selectedSubjectMode === 'existing' ? (
              <select
                value={existingSubjectName}
                onChange={(e) => setExistingSubjectName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
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
                placeholder="مثال: الحروف المتصلة والمقاطع"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              />
            )}
          </div>

          {/* 2. Question Builder (Col 1: Text + Image + Audio in custom order) */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-slate-700">
                2. السؤال (العمود الأول — يقبل نص + صورة + صوت بترتيب حر):
              </label>
            </div>

            <div className="space-y-2.5">
              {questionOrder.map((blockType, idx) => (
                <div
                  key={blockType}
                  className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-slate-600 flex items-center gap-1.5">
                      {blockType === 'text' && <FileText className="w-3.5 h-3.5 text-teal-600" />}
                      {blockType === 'image' && <ImageIcon className="w-3.5 h-3.5 text-sky-600" />}
                      {blockType === 'audio' && <Volume2 className="w-3.5 h-3.5 text-amber-600" />}
                      <span>
                        {blockType === 'text'
                          ? 'نص السؤال'
                          : blockType === 'image'
                          ? 'رابط الصورة (Google Drive أو مباشر)'
                          : 'ملف الصوت (رابط أو تسجيل مباشر)'}
                      </span>
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveQuestionBlock(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-35 cursor-pointer"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveQuestionBlock(idx, 'down')}
                        disabled={idx === questionOrder.length - 1}
                        className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-35 cursor-pointer"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {blockType === 'text' && (
                    <input
                      type="text"
                      value={qText}
                      onChange={(e) => setQText(e.target.value)}
                      placeholder="مثال: رتب الحروف لتكوين كلمة «باب»"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    />
                  )}

                  {blockType === 'image' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={qImageUrl}
                        onChange={(e) => setQImageUrl(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        dir="ltr"
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                      {qImageUrl.trim() && (
                        <img
                          src={getDirectImageUrl(qImageUrl)}
                          alt="معاينة"
                          onClick={() => setPreviewLightboxUrl(getDirectImageUrl(qImageUrl))}
                          className="w-9 h-9 rounded-lg object-cover border border-slate-300 cursor-zoom-in shrink-0"
                        />
                      )}
                    </div>
                  )}

                  {blockType === 'audio' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={qAudioUrl}
                        onChange={(e) => setQAudioUrl(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        dir="ltr"
                        className="flex-1 min-w-[180px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={handleOpenVoiceModal}
                        className="inline-flex items-center gap-1 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-bold cursor-pointer shrink-0"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>تسجيل صوت</span>
                      </button>
                      {qAudioUrl.trim() && (
                        <button
                          type="button"
                          onClick={() => handlePlayPreviewAudio('q-aud', qAudioUrl)}
                          className="inline-flex items-center gap-1 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-[11px] font-bold cursor-pointer shrink-0"
                        >
                          {playingAudioKey === 'q-aud' ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 3. Correct Answer (Col 3) */}
          <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-extrabold text-emerald-950">
                3. الإجابة الصحيحة (العمود الثالث — يدعم الفراغ الناقص بصيغة |...|):
              </label>
              <button
                type="button"
                onClick={handleMarkSelectionAsBlank}
                className="px-2.5 py-1 bg-white hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
              >
                تحديد الجزء المظلل كفراغ |...|
              </button>
            </div>

            <input
              ref={answerInputRef}
              type="text"
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              placeholder="مثال: باب — أو: ذهب محمد إلى المدرسة — أو للفراغ: الـ|ـسـ|ـلام"
              className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl font-amiri text-xl font-bold text-slate-900"
            />

            {correctAnswer.trim() && (
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-900 font-bold">
                  النوع المكتشف: {getDictationTypeLabel(liveDetectedType)}
                </span>
                {liveBlanks.hasBlanks && (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-bold">
                    الفراغات المطلوبة: {liveBlanks.expectedBlanks.join(' ، ')}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 4. Scrambled Pool (Col 2) */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-extrabold text-slate-800">
                4. الحروف أو الكلمات المشتتة (العمود الثاني — افصل بمسافة أو |):
              </label>
              <button
                type="button"
                onClick={handleAutoGenerateScrambled}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer"
              >
                <Wand2 className="w-3 h-3" />
                <span>✨ تفكيك تلقائي من الإجابة</span>
              </button>
            </div>

            <input
              type="text"
              value={scrambledPool}
              onChange={(e) => setScrambledPool(e.target.value)}
              placeholder="مثال: ب ا ب ف ر  — أو: ـسـ ـكـ ك س سـ  — أو: المدرسة ذهب إلى محمد"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-amiri text-xl font-bold text-slate-900"
            />

            {liveTilesPreview.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-500 ml-1">معاينة البطاقات:</span>
                {liveTilesPreview.map((tok, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-amiri text-lg font-bold text-slate-800"
                  >
                    {tok}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 5. Default Settings (Col 4) */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={allowRetry}
                onChange={(e) => setAllowRetry(e.target.checked)}
                className="w-4 h-4 accent-teal-600 rounded"
              />
              <span>السماح للطالب بإعادة التمرين بعد تسجيل الإجابة</span>
            </label>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <span>مدة استماع الميكروفون (ثواني):</span>
              <input
                type="number"
                min={2}
                max={20}
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(Math.max(2, Number(e.target.value) || 5))}
                className="w-16 px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-center"
              />
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-extrabold transition-all shadow-md shadow-teal-600/20 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{editingInfo ? 'حفظ التعديلات في ورقة كلمات' : 'إضافة التمرين في ورقة كلمات'}</span>
            </button>

            {editingInfo && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold cursor-pointer"
              >
                إلغاء التعديل
              </button>
            )}
          </div>
        </form>
      )}

      {/* Voice Recorder Modal for Question Audio */}
      {voiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative space-y-4">
            <button
              type="button"
              onClick={handleCloseVoiceModal}
              className="absolute left-4 top-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h4 className="text-base font-extrabold text-slate-900">
              تسجيل صوت السؤال ورفعه إلى Google Drive 🎙️
            </h4>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">اسم الملف في Drive:</label>
              <input
                type="text"
                value={customVoiceFileName}
                onChange={(e) => setCustomVoiceFileName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
              />
            </div>

            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200 gap-3">
              {!isRecordingVoiceModal && !modalAudioBlobUrl && (
                <button
                  type="button"
                  onClick={handleStartVoiceModalRecording}
                  className="flex items-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold shadow-md cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                  <span>بدء التسجيل</span>
                </button>
              )}

              {isRecordingVoiceModal && (
                <button
                  type="button"
                  onClick={handleStopVoiceModalRecording}
                  className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl text-xs font-bold animate-pulse cursor-pointer"
                >
                  <MicOff className="w-4 h-4 text-rose-400" />
                  <span>إيقاف التسجيل ({voiceRecordSeconds} ث)</span>
                </button>
              )}

              {modalAudioBlobUrl && (
                <div className="w-full space-y-3">
                  <audio controls src={modalAudioBlobUrl} className="w-full h-10" />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetVoiceModalRecording}
                      className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>إعادة</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleUploadModalAudioToDrive}
                      disabled={isUploadingToDrive}
                      className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isUploadingToDrive ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>{isUploadingToDrive ? 'جاري الرفع...' : 'حفظ ورفع لـ Drive'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {driveUploadResult && (
              <div
                className={`p-3 rounded-xl text-xs font-bold border ${
                  driveUploadResult.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {driveUploadResult.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Preview Lightbox */}
      {previewLightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/80 flex items-center justify-center p-4"
          onClick={() => setPreviewLightboxUrl(null)}
        >
          <img
            src={previewLightboxUrl}
            alt="معاينة الصورة"
            className="max-h-[82vh] rounded-2xl border-4 border-white bg-white object-contain"
          />
        </div>
      )}
    </div>
  );
};
