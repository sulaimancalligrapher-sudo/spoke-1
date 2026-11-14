import React, { useRef, useState } from 'react';
import { MatchingLessonSubject, MatchingExercise, MatchingPair } from '../types';
import {
  saveMatchingExerciseToSheets,
  fetchMatchingExercisesFromSheets,
  exportAllMatchingCurriculumToSheets,
  uploadAudioToDrive,
  DEFAULT_DRIVE_AUDIO_FOLDER_ID,
  DEFAULT_WEBHOOK_URL,
  STORAGE_KEY_MATCHING_CURRICULUM,
} from '../utils/googleSheets';
import {
  QuestionBlockType,
  MatchingCardType,
  parseQuestionBlocks,
  formatQuestionBlocks,
  getQuestionPlainText,
  parseMatchingCardValue,
  formatMatchingCardValue,
  getCardAdminPreview,
  getDirectImageUrl,
} from '../utils/matchingMedia';
import { getAlternativeAudioUrls } from '../utils/mediaUrl';
import {
  Plus,
  Trash2,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  List,
  Edit3,
  UploadCloud,
  X,
  Image as ImageIcon,
  Volume2,
  Mic,
  Square,
  Play,
  Pause,
  ArrowUp,
  ArrowDown,
  FileText,
  Loader2,
} from 'lucide-react';

interface MatchingAdminManagerProps {
  subjects: MatchingLessonSubject[];
  onUpdateSubjects: (subjects: MatchingLessonSubject[]) => void;
  webhookUrl?: string;
  driveFolderId?: string;
}

interface PairSideDraft {
  type: MatchingCardType;
  text: string; // Word text (for 'text') OR speech recognition text (for 'image'/'audio')
  mediaUrl: string;
}

interface PairDraft {
  right: PairSideDraft;
  left: PairSideDraft;
}

function emptySide(): PairSideDraft {
  return { type: 'text', text: '', mediaUrl: '' };
}

function defaultPairs(): PairDraft[] {
  return [
    { right: emptySide(), left: emptySide() },
    { right: emptySide(), left: emptySide() },
    { right: emptySide(), left: emptySide() },
  ];
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

export const MatchingAdminManager: React.FC<MatchingAdminManagerProps> = ({
  subjects,
  onUpdateSubjects,
  webhookUrl,
  driveFolderId,
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

  // Flexible Question Builder (Text + Image + Audio in custom teacher order)
  const [questionOrder, setQuestionOrder] = useState<QuestionBlockType[]>(['text', 'image', 'audio']);
  const [qText, setQText] = useState<string>('');
  const [qImageUrl, setQImageUrl] = useState<string>('');
  const [qAudioUrl, setQAudioUrl] = useState<string>('');

  // Word / Media Pairs Builder
  const [pairs, setPairs] = useState<PairDraft[]>(defaultPairs);

  // Answer Behavior Controls:
  const [inputMode, setInputMode] = useState<'both' | 'voice_only'>('both');
  const [durationSeconds, setDurationSeconds] = useState<number>(4);
  const [lockOnMistake, setLockOnMistake] = useState<boolean>(false);
  const [showMistakeFeedback, setShowMistakeFeedback] = useState<boolean>(true);
  const [allowSmartReassign, setAllowSmartReassign] = useState<boolean>(false);

  const [statusMessage, setStatusMessage] = useState<{
    success: boolean;
    text: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Inline Audio Recording & Upload State (targetKey: 'question' | 'pair-{idx}-right' | 'pair-{idx}-left')
  const [recordingTargetKey, setRecordingTargetKey] = useState<string | null>(null);
  const [uploadingTargetKey, setUploadingTargetKey] = useState<string | null>(null);
  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);
  const [previewLightboxUrl, setPreviewLightboxUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Preview audio playback helper
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

  // Inline mic recording -> direct upload to Google Drive
  const stopCurrentMicStream = () => {
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      mediaStreamRef.current = null;
    }
  };

  const handleToggleDirectAudioRecord = async (
    targetKey: string,
    suggestedName: string,
    onUrlReady: (driveUrl: string) => void
  ) => {
    // If currently recording this target -> stop & upload
    if (recordingTargetKey === targetKey && mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      return;
    }

    // Stop any other active recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    stopCurrentMicStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stopCurrentMicStream();
        mediaRecorderRef.current = null;
        setRecordingTargetKey(null);

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0) return;

        setUploadingTargetKey(targetKey);
        try {
          const base64 = await blobToBase64(blob);
          const effectiveWebhook = (webhookUrl || DEFAULT_WEBHOOK_URL).trim();
          const targetFolder = (driveFolderId || DEFAULT_DRIVE_AUDIO_FOLDER_ID).trim();
          const cleanName = (suggestedName || 'matching_audio').replace(/\s+/g, '_').slice(0, 40);

          const res = await uploadAudioToDrive(
            effectiveWebhook,
            base64,
            cleanName,
            targetFolder,
            cleanName
          );

          if (res.success && res.audioUrl) {
            onUrlReady(res.audioUrl);
            setStatusMessage({
              success: true,
              text: 'تم تسجيل الصوت ورفعه إلى Google Drive وإدراج رابطه بنجاح! ✓',
            });
          } else {
            // Fallback to local data URI if Drive upload fails
            onUrlReady(`data:audio/webm;base64,${base64}`);
            setStatusMessage({
              success: false,
              text: res.message || 'تعذر الرفع إلى Google Drive، تم حفظ الصوت مؤقتاً داخل المتصفح.',
            });
          }
        } catch {
          setStatusMessage({
            success: false,
            text: 'حدث خطأ أثناء معالجة التسجيل الصوتي.',
          });
        } finally {
          setUploadingTargetKey(null);
        }
      };

      recorder.start();
      setRecordingTargetKey(targetKey);
    } catch {
      alert('يرجى السماح بالوصول إلى الميكروفون لتسجيل الصوت.');
      setRecordingTargetKey(null);
    }
  };

  // Move question block up/down
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

  // Add pair row
  const handleAddPairRow = () => {
    setPairs((prev) => [...prev, { right: emptySide(), left: emptySide() }]);
  };

  // Remove pair row
  const handleRemovePairRow = (index: number) => {
    if (pairs.length <= 1) return;
    setPairs((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Update side field
  const handlePairSideChange = (
    index: number,
    side: 'right' | 'left',
    patch: Partial<PairSideDraft>
  ) => {
    setPairs((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [side]: {
          ...next[index][side],
          ...patch,
        },
      };
      return next;
    });
  };

  const resetFormFields = () => {
    setQuestionOrder(['text', 'image', 'audio']);
    setQText('');
    setQImageUrl('');
    setQAudioUrl('');
    setPairs(defaultPairs());
    setInputMode('both');
    setDurationSeconds(4);
    setLockOnMistake(false);
    setShowMistakeFeedback(true);
    setAllowSmartReassign(false);
  };

  // Start Editing an existing exercise
  const handleStartEdit = (subj: MatchingLessonSubject, ex: MatchingExercise) => {
    setSelectedSubjectMode('existing');
    setExistingSubjectName(subj.subjectName);

    // Parse flexible question blocks and preserve their exact order
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
    const finalOrder: QuestionBlockType[] = [
      ...seenTypes,
      ...allTypes.filter((t) => !seenTypes.includes(t)),
    ];

    setQuestionOrder(finalOrder);
    setQText(nextText);
    setQImageUrl(nextImg);
    setQAudioUrl(nextAud);

    // Parse pairs
    setPairs(
      ex.pairs.length > 0
        ? ex.pairs.map((p) => {
            const r = parseMatchingCardValue(p.rightText);
            const l = parseMatchingCardValue(p.leftText);
            return {
              right: { type: r.type, text: r.text, mediaUrl: r.mediaUrl },
              left: { type: l.type, text: l.text, mediaUrl: l.mediaUrl },
            };
          })
        : defaultPairs()
    );

    setInputMode(ex.inputMode || 'both');
    setDurationSeconds(typeof ex.durationSeconds === 'number' && ex.durationSeconds > 0 ? ex.durationSeconds : 4);
    setLockOnMistake(!!ex.lockOnMistake);
    setShowMistakeFeedback(ex.showMistakeFeedback !== false);
    setAllowSmartReassign(!!ex.allowSmartReassign);
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
    resetFormFields();
    setStatusMessage(null);
    setSubTab('list');
  };

  // Build final serialized question string according to teacher's chosen order
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

    const finalQuestionString = buildFinalQuestionString();
    if (!finalQuestionString) {
      alert('يرجى إدخال عنصر واحد على الأقل في السؤال (نص السؤال، أو صورة، أو ملف صوت)');
      return;
    }

    // Validate pairs
    const validPairs = pairs.filter((p) => {
      const rightValid =
        p.right.type === 'text' ? Boolean(p.right.text.trim()) : Boolean(p.right.mediaUrl.trim());
      const leftValid =
        p.left.type === 'text' ? Boolean(p.left.text.trim()) : Boolean(p.left.mediaUrl.trim());
      return rightValid && leftValid;
    });

    if (validPairs.length < 2) {
      alert('يرجى إدخال زوجين مكتملين على الأقل (نص أو رابط صورة/صوت في اليمين واليسار)');
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    const formattedPairs: MatchingPair[] = validPairs.map((p, idx) => ({
      id: `p-${Date.now()}-${idx + 1}`,
      rightText: formatMatchingCardValue(p.right),
      leftText: formatMatchingCardValue(p.left),
    }));

    let nextSubjects: MatchingLessonSubject[];
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
                  pairs: formattedPairs,
                  inputMode,
                  durationSeconds,
                  lockOnMistake,
                  showMistakeFeedback,
                  allowSmartReassign: lockOnMistake ? false : allowSmartReassign,
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

      const newExercise: MatchingExercise = {
        id: `match-ex-${Date.now()}`,
        exerciseNumber: exerciseNumberToSave,
        questionText: finalQuestionString,
        pairs: formattedPairs,
        inputMode,
        durationSeconds,
        lockOnMistake,
        showMistakeFeedback,
        allowSmartReassign: lockOnMistake ? false : allowSmartReassign,
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
          questionText: finalQuestionString,
          pairs: formattedPairs,
          inputMode,
          durationSeconds,
          lockOnMistake,
          showMistakeFeedback,
          allowSmartReassign: lockOnMistake ? false : allowSmartReassign,
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
    resetFormFields();
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

  const liveSerializedQuestion = buildFinalQuestionString();

  const renderPairSideEditor = (
    idx: number,
    side: 'right' | 'left',
    draft: PairSideDraft,
    sideTitle: string
  ) => {
    const targetKey = `pair-${idx}-${side}`;
    const isRec = recordingTargetKey === targetKey;
    const isUpl = uploadingTargetKey === targetKey;
    const isPlaying = playingAudioKey === targetKey;

    return (
      <div className="flex-1 bg-white p-3 rounded-xl border border-slate-200/90 space-y-2.5 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-extrabold text-slate-700">{sideTitle}</span>
          {/* 3-option mode selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => handlePairSideChange(idx, side, { type: 'text' })}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                draft.type === 'text'
                  ? 'bg-white text-purple-800 shadow-2xs border border-purple-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>نص</span>
            </button>
            <button
              type="button"
              onClick={() => handlePairSideChange(idx, side, { type: 'image' })}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                draft.type === 'image'
                  ? 'bg-white text-sky-800 shadow-2xs border border-sky-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ImageIcon className="w-3 h-3" />
              <span>صورة</span>
            </button>
            <button
              type="button"
              onClick={() => handlePairSideChange(idx, side, { type: 'audio' })}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                draft.type === 'audio'
                  ? 'bg-white text-amber-800 shadow-2xs border border-amber-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Volume2 className="w-3 h-3" />
              <span>صوت</span>
            </button>
          </div>
        </div>

        {draft.type === 'text' && (
          <input
            type="text"
            value={draft.text}
            onChange={(e) => handlePairSideChange(idx, side, { text: e.target.value })}
            placeholder={side === 'right' ? 'الكلمة في اليمين (مثال: كَبِير)' : 'الكلمة في اليسار (مثال: صَغِير)'}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-amiri font-bold text-slate-800 focus:outline-hidden focus:border-purple-500 text-right"
          />
        )}

        {draft.type === 'image' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draft.mediaUrl}
                onChange={(e) => handlePairSideChange(idx, side, { mediaUrl: e.target.value })}
                placeholder="رابط صورة Google Drive..."
                dir="ltr"
                className="flex-1 min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-sky-500 font-mono"
              />
              {draft.mediaUrl.trim() && (
                <button
                  type="button"
                  onClick={() => setPreviewLightboxUrl(getDirectImageUrl(draft.mediaUrl))}
                  className="w-10 h-10 rounded-xl border border-sky-200 bg-sky-50 overflow-hidden shrink-0 hover:opacity-90 cursor-pointer"
                  title="معاينة الصورة"
                >
                  <img
                    src={getDirectImageUrl(draft.mediaUrl)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              )}
            </div>
            <input
              type="text"
              value={draft.text}
              onChange={(e) => handlePairSideChange(idx, side, { text: e.target.value })}
              placeholder="نص النطق للصورة (مثال: تُفَّاح) — للتوصيل الصوتي"
              className="w-full px-3 py-1.5 bg-amber-50/50 border border-amber-200/80 rounded-xl text-xs font-amiri font-bold text-slate-800 focus:outline-hidden focus:border-amber-500 text-right"
            />
          </div>
        )}

        {draft.type === 'audio' && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="text"
                value={draft.mediaUrl}
                onChange={(e) => handlePairSideChange(idx, side, { mediaUrl: e.target.value })}
                placeholder="رابط صوت Google Drive أو سجّل مباشرة..."
                dir="ltr"
                className="flex-1 min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-amber-500 font-mono"
              />

              <button
                type="button"
                disabled={isUpl}
                onClick={() =>
                  handleToggleDirectAudioRecord(
                    targetKey,
                    draft.text || `وصل_${side}_${idx + 1}`,
                    (url) => handlePairSideChange(idx, side, { mediaUrl: url })
                  )
                }
                className={`px-2.5 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all shrink-0 border ${
                  isRec
                    ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                    : isUpl
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                }`}
                title="تسجيل صوت المعلم ورفعه تلقائياً إلى Google Drive"
              >
                {isUpl ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الرفع...</span>
                  </>
                ) : isRec ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>إيقاف وحفظ</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5" />
                    <span>تسجيل</span>
                  </>
                )}
              </button>

              {draft.mediaUrl.trim() && (
                <button
                  type="button"
                  onClick={() => handlePlayPreviewAudio(targetKey, draft.mediaUrl)}
                  className={`p-2 rounded-xl border transition-all cursor-pointer shrink-0 ${
                    isPlaying
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}
                  title="استماع لمعاينة الصوت"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            <input
              type="text"
              value={draft.text}
              onChange={(e) => handlePairSideChange(idx, side, { text: e.target.value })}
              placeholder="نص النطق للصوت (مثال: بَاب) — للتوصيل الصوتي"
              className="w-full px-3 py-1.5 bg-amber-50/50 border border-amber-200/80 rounded-xl text-xs font-amiri font-bold text-slate-800 focus:outline-hidden focus:border-amber-500 text-right"
            />
          </div>
        )}
      </div>
    );
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
            إضافة وتعديل أسئلة وأزواج التوصيل (نصوص، صور، وملفات صوت من Google Drive) المحفوظة في ورقة <strong>وصل</strong>
          </p>
        </div>

        {/* Action Buttons: Export to Sheets, List, Add/Edit */}
        <div className="flex flex-wrap items-center gap-2">
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
              أنت الآن في وضع <strong>تعديل التمرين {editingInfo.exerciseNumber}</strong>. قم بتعديل السؤال أو الأزواج ثم اضغط حفظ.
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

          {/* Section: Flexible Ordered Question Builder (Text + Image + Audio) */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-900">
                  محتوى السؤال وترتيب العرض (العامود الأول للتمرين في ورقة وصل):
                </label>
                <span className="text-[11px] text-slate-400">
                  يمكنك إضافة نص أو صورة أو ملف صوت (أو جميعها معاً) وتغيير ترتيب ظهورها بالأسهم ⬆️⬇️
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              {questionOrder.map((blockType, bIdx) => {
                const isFirst = bIdx === 0;
                const isLast = bIdx === questionOrder.length - 1;
                const qRecActive = recordingTargetKey === 'question';
                const qUplActive = uploadingTargetKey === 'question';
                const qPlaying = playingAudioKey === 'question';

                return (
                  <div
                    key={blockType}
                    className="p-3 bg-slate-50/90 border border-slate-200 rounded-2xl flex items-start gap-2.5"
                  >
                    {/* Up/Down Reorder Controls */}
                    <div className="flex flex-col gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => handleMoveQuestionBlock(bIdx, 'up')}
                        className="p-1 bg-white hover:bg-purple-50 text-slate-600 hover:text-purple-700 disabled:opacity-30 rounded-lg border border-slate-200 cursor-pointer"
                        title="تحريك للأعلى"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => handleMoveQuestionBlock(bIdx, 'down')}
                        className="p-1 bg-white hover:bg-purple-50 text-slate-600 hover:text-purple-700 disabled:opacity-30 rounded-lg border border-slate-200 cursor-pointer"
                        title="تحريك للأسفل"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Block Content */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {blockType === 'text' && (
                        <>
                          <span className="text-[11px] font-bold text-purple-800 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            <span>نص السؤال (اختياري):</span>
                          </span>
                          <input
                            type="text"
                            value={qText}
                            onChange={(e) => setQText(e.target.value)}
                            placeholder="مثال: صِلْ بَيْنَ الكَلِمَةِ وَضِدِّهَا المُنَاسِب"
                            className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-hidden focus:border-purple-500 font-amiri"
                          />
                        </>
                      )}

                      {blockType === 'image' && (
                        <>
                          <span className="text-[11px] font-bold text-sky-800 flex items-center gap-1">
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>صورة السؤال من Google Drive (اختياري):</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={qImageUrl}
                              onChange={(e) => setQImageUrl(e.target.value)}
                              placeholder="الصق رابط صورة Google Drive هنا..."
                              dir="ltr"
                              className="flex-1 min-w-0 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-sky-500 font-mono"
                            />
                            {qImageUrl.trim() && (
                              <button
                                type="button"
                                onClick={() => setPreviewLightboxUrl(getDirectImageUrl(qImageUrl))}
                                className="w-11 h-11 rounded-xl border border-sky-200 bg-white overflow-hidden shrink-0 hover:opacity-90 cursor-pointer"
                                title="اضغط لتكبير ومعاينة الصورة"
                              >
                                <img
                                  src={getDirectImageUrl(qImageUrl)}
                                  alt="معاينة صورة السؤال"
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            )}
                          </div>
                        </>
                      )}

                      {blockType === 'audio' && (
                        <>
                          <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>ملف صوت السؤال من Google Drive أو تسجيل مباشر (اختياري):</span>
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <input
                              type="text"
                              value={qAudioUrl}
                              onChange={(e) => setQAudioUrl(e.target.value)}
                              placeholder="الصق رابط صوت Google Drive أو اضغط تسجيل..."
                              dir="ltr"
                              className="flex-1 min-w-0 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-amber-500 font-mono"
                            />
                            <button
                              type="button"
                              disabled={qUplActive}
                              onClick={() =>
                                handleToggleDirectAudioRecord(
                                  'question',
                                  qText || 'صوت_السؤال',
                                  (url) => setQAudioUrl(url)
                                )
                              }
                              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shrink-0 border ${
                                qRecActive
                                  ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                                  : qUplActive
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                              }`}
                            >
                              {qUplActive ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>جاري الرفع لـ Drive...</span>
                                </>
                              ) : qRecActive ? (
                                <>
                                  <Square className="w-3.5 h-3.5 fill-current" />
                                  <span>إيقاف وحفظ</span>
                                </>
                              ) : (
                                <>
                                  <Mic className="w-3.5 h-3.5" />
                                  <span>تسجيل ورفع لـ Drive</span>
                                </>
                              )}
                            </button>

                            {qAudioUrl.trim() && (
                              <button
                                type="button"
                                onClick={() => handlePlayPreviewAudio('question', qAudioUrl)}
                                className={`p-2 rounded-xl border transition-all cursor-pointer shrink-0 ${
                                  qPlaying
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                }`}
                                title="استماع لمعاينة صوت السؤال"
                              >
                                {qPlaying ? (
                                  <Pause className="w-4 h-4" />
                                ) : (
                                  <Play className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {liveSerializedQuestion && (
              <div className="px-3 py-2 bg-purple-50/60 border border-purple-200/70 rounded-xl text-[11px] text-purple-900 font-mono truncate" dir="rtl">
                <span className="font-sans font-bold text-purple-700 ml-1.5">المعاينة في الشيت:</span>
                {liveSerializedQuestion}
              </div>
            )}
          </div>

          {/* Section: Word / Media Pairs Builder */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-900">
                  أزواج التوصيل (العامود 2 في اليمين ⟷ العامود 3 في اليسار):
                </label>
                <span className="text-[11px] text-slate-400">
                  اختر لكل بطاقة نوعها (نص أو صورة أو صوت). عند اختيار صورة أو صوت يمكنك كتابة «نص النطق» ليعمل التوصيل الصوتي أيضاً!
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {pairs.map((pair, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50/90 border border-slate-200/90 rounded-2xl flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5"
                >
                  <div className="flex items-center justify-between lg:justify-center gap-2 shrink-0">
                    <span className="text-xs font-black text-purple-700 bg-purple-100 w-6 h-6 rounded-lg flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemovePairRow(idx)}
                      disabled={pairs.length <= 1}
                      className="lg:hidden p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-lg cursor-pointer transition-colors"
                      title="حذف هذا الزوج"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Right Side */}
                  {renderPairSideEditor(idx, 'right', pair.right, 'العمود الأيمن')}

                  {/* Connector icon */}
                  <div className="text-slate-300 font-bold shrink-0 text-center hidden lg:block">⟷</div>

                  {/* Left Side */}
                  {renderPairSideEditor(idx, 'left', pair.left, 'العمود الأيسر')}

                  {/* Delete button (Desktop) */}
                  <button
                    type="button"
                    onClick={() => handleRemovePairRow(idx)}
                    disabled={pairs.length <= 1}
                    className="hidden lg:block p-2 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-lg cursor-pointer transition-colors shrink-0"
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
              <span>+ إضافة زوج آخر</span>
            </button>
          </div>

          {/* Section: Answer Behavior Controls */}
          <div className="p-4 bg-purple-50/70 border border-purple-200/90 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-700" />
              <h4 className="text-xs font-black text-purple-950">
                خيارات طريقة الإجابة وسلوك التوصيل للطالب (تُحفظ في العامود 4 بورقة وصل):
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Control 1 */}
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
                    ? '✓ صوت فقط: سيظهر للطالب زر النطق فقط (يتعطل النقر للتوصيل لإلزام الطالب بالنطق الصوتي).'
                    : 'الافتراضي: يظهر للطالب زرا الفأرة والصوت ويمكنه الاختيار بينهما بحرية.'}
                </p>
              </div>

              {/* Control 2 */}
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

              {/* Control 3 */}
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
                    onClick={() => {
                      setLockOnMistake(true);
                      setAllowSmartReassign(false);
                    }}
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

              {/* Control 4 */}
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

              {/* Control 5 */}
              <div className="sm:col-span-2 p-3 bg-white rounded-xl border border-purple-200 shadow-2xs space-y-2">
                <span className="text-[11px] font-extrabold text-slate-800 block">
                  5. فك وتصحيح الخطأ الذكي (السماح بتبديل الإجابة):
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAllowSmartReassign(false)}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                      !allowSmartReassign
                        ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ⏹️ إيقاف التصحيح الذكي
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAllowSmartReassign(true);
                      setLockOnMistake(false);
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                      allowSmartReassign && !lockOnMistake
                        ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🧠 تفعيل فك وتصحيح الخطأ الذكي
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  {allowSmartReassign && !lockOnMistake
                    ? '✓ مفعّل: تبقى التوصيلات المخطئة (أو البنفسجية عند إخفاء الخطأ) ظاهرة على اللوحة، وإذا أعاد الطالب توصيل أي كلمة منها بكلمة أخرى يُفك الربط السابق تلقائياً وتُصحح الإجابة.'
                    : 'الافتراضي: عند إظهار الخطأ يختفي الخط الخاطئ فوراً للتحاول مجدداً، وعند إخفاء الخطأ يثبت التوصيل البنفسجي ولا يمكن تبديل الإجابة.'}
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
                  {subj.exercises.map((ex) => {
                    const qBlocks = parseQuestionBlocks(ex.questionText);
                    const hasQImg = qBlocks.some((b) => b.type === 'image');
                    const hasQAud = qBlocks.some((b) => b.type === 'audio');

                    return (
                      <div
                        key={ex.id}
                        className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-purple-200 transition-all"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 text-[10px] font-bold">
                              تمرين {ex.exerciseNumber}
                            </span>
                            {hasQImg && (
                              <span className="px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-900 text-[9px] font-bold">
                                🖼️ صورة سؤال
                              </span>
                            )}
                            {hasQAud && (
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[9px] font-bold">
                                🔊 صوت سؤال
                              </span>
                            )}
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
                            {ex.allowSmartReassign && !ex.lockOnMistake && (
                              <span className="px-1.5 py-0.5 rounded-md bg-teal-100 text-teal-900 text-[9px] font-bold" title="فك وتصحيح الخطأ الذكي مفعّل">
                                🧠 تصحيح ذكي
                              </span>
                            )}
                            <span className="font-amiri text-base font-bold text-slate-800 truncate">
                              {getQuestionPlainText(ex.questionText)}
                            </span>
                          </div>

                          {/* Words/Media summary preview */}
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {ex.pairs.map((p) => (
                              <span
                                key={p.id}
                                className="px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-[11px] font-amiri text-slate-700"
                              >
                                {getCardAdminPreview(p.rightText)} ⟷ {getCardAdminPreview(p.leftText)}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Action buttons: Edit & Delete */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(subj, ex)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-purple-200"
                            title="تعديل هذا التمرين"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>تعديل</span>
                          </button>

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
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Image Preview Lightbox Modal */}
      {previewLightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewLightboxUrl(null)}
        >
          <div
            className="bg-white rounded-3xl p-3 max-w-xl w-full relative shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewLightboxUrl(null)}
              className="absolute left-3 top-3 p-1.5 bg-slate-900/80 text-white rounded-full hover:bg-slate-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewLightboxUrl}
              alt="معاينة الصورة"
              className="w-full max-h-[75vh] object-contain rounded-2xl bg-slate-50"
            />
          </div>
        </div>
      )}
    </div>
  );
};
