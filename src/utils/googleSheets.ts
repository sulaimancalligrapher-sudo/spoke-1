import {
  WordItem,
  StudentSubmissionRecord,
  StudentRegistrant,
  HomeBrandConfig,
  SocialLinkItem,
  PracticeHistoryItem,
  Answers1SubmissionRow,
  AdminUserRecord,
  MatchingLessonSubject,
  MatchingExercise,
  MatchingPair,
  MatchingHistoryItem,
  MatchingExerciseHistoryEntry,
  DictationLessonSubject,
  DictationExercise,
  DictationHistoryItem,
  DictationExerciseHistoryEntry,
} from '../types';
import { removeTashkeel } from './arabicMatcher';
import { INITIAL_MATCHING_SUBJECTS } from '../data/matchingCurriculum';
import { INITIAL_DICTATION_SUBJECTS } from '../data/dictationCurriculum';
import { formatDictationSettingsString, parseDictationSettingsString } from './dictationUtils';

export const DEFAULT_DRIVE_AUDIO_FOLDER_ID = '1YuCKWxGjQn9E2EAKqoKN-7-Kl_UeDC4t'; // مجلد أصوات وشرح المعلم
export const STUDENT_AUDIO_DRIVE_FOLDER_ID = '1o80NgUVp64TwTt_yRn3I83c6gy8Ce1iA'; // مجلد تسجيلات أصوات الطلاب
export const DEFAULT_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbzEeTOdI7vI7ISya739KsbXQ_wFvzh6W5c1VGZGng0QTLYsPzB7NqXOyL-BmcZKyVRqmA/exec';

/**
 * Convert any Google Drive image / gif / webp / svg link to direct viewable high-res thumbnail
 */
export function normalizeDriveImageUrl(url?: string): string {
  if (!url) return '';
  const clean = url.trim();
  if (clean.includes('drive.google.com')) {
    let fileId = '';
    const matchD = clean.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (matchD && matchD[1]) {
      fileId = matchD[1];
    } else {
      const matchId = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (matchId && matchId[1]) {
        fileId = matchId[1];
      }
    }
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
    }
  }
  return clean;
}

/**
 * Fetch curriculum (lessons and exercises) directly from Google Sheet tab "الدروس"
 * Supports the horizontal layout:
 * - Col A: موضوع الدرس
 * - Col B:I (1st word / text)
 * - Col J:Q (2nd word / text)
 * - Col R:Y (3rd word / text)
 * - Col Z:AG (4th word / text) ... and so on!
 */
/**
 * Sends a POST request to Google Apps Script.
 * 1. First tries the local /api/google-sheets proxy (eliminates all browser CORS errors).
 * 2. If the proxy returns an error message or fails to connect:
 *    Falls back to direct fetch.
 * 3. If direct fetch triggers a browser CORS/redirect error (TypeError: Failed to fetch),
 *    retries with mode: 'no-cors' so the browser delivers the payload directly to Google Apps Script!
 */
export async function callGoogleSheetsPost(webhookUrl: string, payload: any): Promise<{
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}> {
  const cleanUrl = webhookUrl.trim();

  // 1. Try server-side proxy first (best for CORS on Vercel & local server)
  try {
    const proxyRes = await fetch('/api/google-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: cleanUrl, payload }),
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json().catch(() => null);
      if (data && data.success === true && !data.error) {
        return { success: true, data, message: data.message };
      }
      if (data && (data.success === false || data.error)) {
        return { success: false, error: data.error || data.message || 'خطأ من مزود Google Sheets' };
      }
    } else {
      const errData = await proxyRes.json().catch(() => null);
      if (errData && (errData.error || errData.message)) {
        return { success: false, error: errData.error || errData.message };
      }
    }
  } catch (proxyErr) {
    console.warn('Proxy fetch failed, attempting direct fetch:', proxyErr);
  }

  // 2. Direct fetch fallback
  try {
    const directRes = await fetch(cleanUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    if (directRes.ok) {
      const data = await directRes.json().catch(() => null);
      return { success: true, data, message: data?.message };
    }
  } catch (directErr: any) {
    console.warn('Direct fetch failed with CORS error, delivering via no-cors mode:', directErr);
    // 3. Fallback to mode: 'no-cors' so the browser delivers the payload directly to Google Apps Script
    try {
      await fetch(cleanUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      return {
        success: true,
        message: 'تم إرسال البيانات إلى Google Sheets بنجاح!',
      };
    } catch (noCorsErr: any) {
      return {
        success: false,
        error: 'تعذر الاتصال بـ Google Sheets: ' + (noCorsErr?.message || 'خطأ في الشبكة'),
      };
    }
  }

  return { success: true, message: 'تم إرسال الطلب إلى Google Sheets!' };
}

/**
 * Fetch curriculum (lessons and exercises) directly from Google Sheet tab "الدروس"
 * Supports the horizontal layout:
 * - Col A: موضوع الدرس
 * - Col B:I (1st word / text)
 * - Col J:Q (2nd word / text)
 * - Col R:Y (3rd word / text)
 * - Col Z:AG (4th word / text) ... and so on!
 */
export async function fetchCurriculumFromSheets(webhookUrl: string): Promise<{
  success: boolean;
  curriculum?: WordItem[];
  subjects?: string[];
  categories?: string[];
  sheetName?: string;
  spreadsheetName?: string;
  spreadsheetUrl?: string;
  error?: string;
}> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, error: 'رابط Google Sheets غير صالح' };
  }

  const cleanUrl = webhookUrl.trim();
  const targetUrl = cleanUrl.includes('?') 
    ? `${cleanUrl}&action=get_curriculum&_t=${Date.now()}` 
    : `${cleanUrl}?action=get_curriculum&_t=${Date.now()}`;

  let data: any = null;

  // 1. Try server-side proxy first (bypasses browser CORS)
  try {
    const proxyRes = await fetch(`/api/google-sheets?url=${encodeURIComponent(targetUrl)}`);
    if (proxyRes.ok) {
      data = await proxyRes.json().catch(() => null);
    } else {
      const errJson = await proxyRes.json().catch(() => null);
      if (errJson && errJson.error) {
        return { success: false, error: errJson.error };
      }
    }
  } catch (proxyErr) {
    console.warn('Proxy GET failed, trying direct fetch:', proxyErr);
  }

  // 2. Direct fetch fallback
  if (!data || !Array.isArray(data.curriculum)) {
    try {
      const directRes = await fetch(targetUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (directRes.ok) {
        data = await directRes.json().catch(() => null);
      }
    } catch (directErr: any) {
      console.warn('Direct GET failed:', directErr);
      if (!data) {
        return {
          success: false,
          error:
            'تم حظر الاتصال بـ Google Sheets (CORS). يرجى التأكد عند نشر السكربت (Deploy) في Google Sheets من ضبط: (من يملك حق الوصول Who has access) = (أي شخص Anyone) وليس (أنا فقط Only myself).',
        };
      }
    }
  }

  if (!data || !Array.isArray(data.curriculum)) {
    return {
      success: false,
      error:
        'لم يتم العثور على تمارين في ورقة "الدروس". تأكد من تسمية الورقة (الدروس) وترتيب الأعمدة A:I ونشر السكربت كـ Web App للجميع (Anyone).',
    };
  }

  const words: WordItem[] = data.curriculum
    .map((item: any, idx: number) => ({
      id: item.id || `sheet-${idx + 1}-${Date.now()}`,
      word: String(item.word || '').trim(),
      plainWord: removeTashkeel(String(item.word || '').trim()),
      meaning: item.meaning !== undefined && item.meaning !== null ? String(item.meaning).trim() : '',
      category: String(item.category || '').trim() || 'الكلمة',
      lessonSubject: String(item.lessonSubject || '').trim() || 'الدرس الأول',
      imageUrl: item.imageUrl ? String(item.imageUrl).trim() : undefined,
      audioUrl: item.audioUrl ? String(item.audioUrl).trim() : undefined,
      autoReadText: item.autoReadText ? String(item.autoReadText).trim() : undefined,
      makhrajTip: item.makhrajTip !== undefined && item.makhrajTip !== null ? String(item.makhrajTip).trim() : '',
      letterFocus: String(item.word || '').trim()[0],
      repeatCount: (() => {
        const raw = String(item.repeatCount || '1').trim();
        const parts = raw.split(/[,|]/).map((s) => s.trim());
        const p = parseInt(parts[0]);
        return !isNaN(p) && p > 0 ? p : 1;
      })(),
      difficultyLevel: (() => {
        if (item.difficultyLevel === 'easy' || item.difficultyLevel === 'hard' || item.difficultyLevel === 'medium') {
          return item.difficultyLevel;
        }
        const raw = String(item.repeatCount || '').trim().toLowerCase();
        if (raw.includes('سهل') || raw.includes('easy')) return 'easy';
        if (raw.includes('متقدم') || raw.includes('hard') || raw.includes('صارم')) return 'hard';
        return 'medium';
      })(),
      recordingDuration: (() => {
        if (typeof item.recordingDuration === 'number' && item.recordingDuration >= 2) {
          return item.recordingDuration;
        }
        const raw = String(item.repeatCount || '').trim();
        const parts = raw.split(/[,|]/).map((s) => s.trim());
        if (parts.length >= 3) {
          const d = parseInt(parts[2].replace(/[^0-9]/g, ''));
          if (!isNaN(d) && d >= 2) return d;
        }
        return 5;
      })(),
      allowRetry: (() => {
        if (typeof item.allowRetry === 'boolean') {
          return item.allowRetry;
        }
        const raw = String(item.repeatCount || '').trim().toLowerCase();
        if (raw.includes('منع') || raw.includes('لا إعادة') || raw.includes('no_retry') || raw.includes('false')) {
          return false;
        }
        return true;
      })(),
    }))
    .filter((w: WordItem) => Boolean(w.word));

  const extractedSubjects: string[] = Array.from(new Set(words.map((w) => w.lessonSubject).filter(Boolean)));
  const extractedCategories: string[] = Array.from(new Set(words.map((w) => w.category).filter(Boolean)));
  return {
    success: true,
    curriculum: words,
    subjects: extractedSubjects.length > 0 ? extractedSubjects : undefined,
    categories: extractedCategories.length > 0 ? extractedCategories : undefined,
    sheetName: data.sheetName,
    spreadsheetName: data.spreadsheetName,
    spreadsheetUrl: data.spreadsheetUrl,
  };
}

/**
 * Save or update a word in Google Sheets (Sheet: "الدروس")
 * Automatically places it in the lesson's row in the corresponding 8-column block (B:I, J:Q, R:Y, ...)
 * and uploads audio to Google Drive folder 1YuCKWxGjQn9E2EAKqoKN-7-Kl_UeDC4t.
 */
export async function saveWordToGoogleSheets(
  webhookUrl: string,
  wordItem: WordItem,
  audioBase64?: string,
  driveFolderId = DEFAULT_DRIVE_AUDIO_FOLDER_ID
): Promise<{ success: boolean; audioUrl?: string; message: string }> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, message: 'رابط Google Sheets غير صالح' };
  }

  const payload = {
    action: 'save_word',
    driveFolderId,
    wordItem: {
      lessonSubject: wordItem.lessonSubject,
      category: wordItem.category,
      imageUrl: wordItem.imageUrl || '',
      audioUrl: wordItem.audioUrl || '',
      autoReadText: wordItem.autoReadText || '',
      word: wordItem.word,
      meaning: wordItem.meaning,
      makhrajTip: wordItem.makhrajTip || '',
      repeatCount: wordItem.repeatCount || 1,
      difficultyLevel: wordItem.difficultyLevel || 'medium',
      recordingDuration: wordItem.recordingDuration || 5,
      allowRetry: wordItem.allowRetry !== false,
    },
    audioBase64: audioBase64 || undefined,
  };

  const res = await callGoogleSheetsPost(webhookUrl, payload);

  return {
    success: res.success,
    audioUrl: res.data?.audioUrl,
    message: res.message || (res.success ? 'تم حفظ التمرين في ورقة "الدروس" بنجاح!' : (res.error || 'خطأ أثناء الحفظ')),
  };
}

/**
 * Upload an audio recording (Base64) to Google Drive folder 1YuCKWxGjQn9E2EAKqoKN-7-Kl_UeDC4t
 * and return the direct Google Drive playable URL
 */
export async function uploadAudioToDrive(
  webhookUrl: string,
  audioBase64: string,
  wordText: string,
  driveFolderId = DEFAULT_DRIVE_AUDIO_FOLDER_ID,
  customFileName?: string
): Promise<{ success: boolean; audioUrl?: string; fileId?: string; message: string }> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, message: 'رابط Google Sheets Webhook غير مدخل' };
  }

  const payload = {
    action: 'upload_audio',
    driveFolderId,
    word: wordText || 'lesson',
    customFileName: customFileName || undefined,
    audioBase64,
  };

  const res = await callGoogleSheetsPost(webhookUrl, payload);
  if (res.success && res.data?.audioUrl) {
    return {
      success: true,
      audioUrl: res.data.audioUrl,
      fileId: res.data.fileId,
      message: res.data.message || 'تم حفظ ورفع ملف الصوت في Google Drive بنجاح!',
    };
  }

  return {
    success: false,
    message: res.error || res.message || 'تعذر رفع الصوت إلى Google Drive. تأكد من تحديث كود السكربت بالنسخة الجديدة.',
  };
}

/**
 * Delete a word from Google Sheets (Sheet: "الدروس")
 */
export async function deleteWordFromGoogleSheets(
  webhookUrl: string,
  wordText: string,
  lessonSubject: string
): Promise<{ success: boolean; message: string }> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, message: 'رابط Google Sheets غير صالح' };
  }

  const res = await callGoogleSheetsPost(webhookUrl, {
    action: 'delete_word',
    word: wordText,
    lessonSubject,
  });

  return {
    success: res.success,
    message: res.success ? 'تم حذف التمرين من ورقة "الدروس" بنجاح' : (res.error || 'خطأ أثناء الحذف'),
  };
}

/**
 * Sync entire curriculum from the App into Google Sheets (Sheet: "الدروس")
 * Groups words by lessonSubject and writes each lesson horizontally with 8-column blocks
 */
export async function syncAllCurriculumToSheets(
  webhookUrl: string,
  curriculum: WordItem[],
  driveFolderId?: string
): Promise<{ success: boolean; count?: number; lessonsCount?: number; message: string }> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, message: 'رابط Google Sheets Webhook غير صالح أو غير مدخل' };
  }

  const payload = {
    action: 'sync_full_curriculum',
    driveFolderId: driveFolderId || DEFAULT_DRIVE_AUDIO_FOLDER_ID,
    curriculum: curriculum.map((item) => ({
      lessonSubject: item.lessonSubject || 'الدرس الأول',
      category: item.category || 'الكلمة',
      imageUrl: item.imageUrl || '',
      audioUrl: item.audioUrl || '',
      autoReadText: item.autoReadText || '',
      word: item.word,
      meaning: item.meaning || '',
      makhrajTip: item.makhrajTip || '',
      repeatCount: item.repeatCount || 1,
      difficultyLevel: item.difficultyLevel || 'medium',
      recordingDuration: item.recordingDuration || 5,
      allowRetry: item.allowRetry !== false,
    })),
  };

  const res = await callGoogleSheetsPost(webhookUrl, payload);

  if (res.success) {
    return {
      success: true,
      count: res.data?.count || curriculum.length,
      lessonsCount: res.data?.lessonsCount,
      message:
        res.data?.message ||
        `تم بنجاح رفع وتحديث ${curriculum.length} كلمة وتدريب في ورقة "الدروس" في Google Sheets بالهيكل الأفقي المعتمد!`,
    };
  }

  return {
    success: false,
    message: res.error || 'تعذر رفع المنهج إلى Google Sheets. تأكد من نشر السكربت بوضعية Anyone.',
  };
}

/**
 * Send a student evaluation record to Google Sheets (Sheet: "سجل_النتائج")
 */
export async function sendScoreToGoogleSheets(
  webhookUrl: string,
  record: StudentSubmissionRecord
): Promise<{ success: boolean; message: string }> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, message: 'رابط Google Sheets غير صالح' };
  }

  const payload = {
    action: 'record_submission',
    timestamp: new Date(record.timestamp).toLocaleString('ar-SA'),
    studentName: record.studentName || 'طالب',
    word: record.word,
    score: record.score,
    grade: record.grade,
    detectedWord: record.detectedWord || '',
    engineUsed: record.engineUsed === 'ai' ? 'ذكاء اصطناعي (Gemini)' : 'النظام الداخلي (مستمر)',
    feedback: record.feedback || '',
  };

  const res = await callGoogleSheetsPost(webhookUrl, payload);
  return {
    success: res.success,
    message: res.success ? 'تم إرسال الدرجة بنجاح إلى جدول Google Sheets!' : (res.error || 'تعذر الاتصال'),
  };
}

/**
 * Initialize or ensure sheet "ID registrants" exists with Col A: ID and Col B: اسم المشترك
 */
export async function ensureIDRegistrantsSheet(webhookUrl: string): Promise<{ success: boolean; message: string }> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, message: 'رابط Google Sheets Webhook غير صالح' };
  }

  const res = await callGoogleSheetsPost(webhookUrl, {
    action: 'init_registrants_sheet',
  });

  return {
    success: res.success,
    message: res.message || (res.success ? 'تم تجهيز ورقة ID registrants بنجاح' : 'خطأ في الاتصال'),
  };
}

/**
 * Fetch all registrants from sheet "ID registrants"
 */
export async function fetchIDRegistrants(webhookUrl: string): Promise<StudentRegistrant[]> {
  if (webhookUrl && webhookUrl.trim().startsWith('http')) {
    try {
      const res = await callGoogleSheetsPost(webhookUrl, { action: 'get_registrants' });
      if (res.success && res.data && Array.isArray(res.data.registrants)) {
        const list: StudentRegistrant[] = res.data.registrants
          .map((r: any) => ({
            id: String(r.id || '').trim(),
            name: String(r.name || '').trim(),
          }))
          .filter((r: StudentRegistrant) => r.id && r.name && r.id !== 'ID' && r.name !== 'اسم المشترك');

        try {
          localStorage.setItem('faseeh_cached_registrants', JSON.stringify(list));
        } catch {}

        if (list.length > 0) return list;
      }
    } catch (e) {
      console.warn('Error fetching ID registrants from Google Sheets:', e);
    }
  }

  // Fallback to local cached registrants
  try {
    const cached = localStorage.getItem('faseeh_cached_registrants');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  // Default demo registrants for offline/initial state
  return [
    { id: '1001', name: 'أحمد علي' },
    { id: '1002', name: 'فاطمة محمد' },
    { id: '1003', name: 'عمر خالد' },
  ];
}

/**
 * Verify student credentials against sheet "ID registrants"
 */
export async function verifyStudentLogin(
  webhookUrl: string,
  enteredName: string,
  enteredId: string
): Promise<{ success: boolean; student?: StudentRegistrant; error?: string }> {
  const cleanName = enteredName.trim();
  const cleanId = enteredId.trim();

  if (!cleanName || !cleanId) {
    return { success: false, error: 'يرجى إدخال اسم المشترك ورقم ID معاً.' };
  }

  const registrants = await fetchIDRegistrants(webhookUrl);

  const normalizeArabic = (s: string) =>
    removeTashkeel(s)
      .toLowerCase()
      .replace(/[إأآا]/g, 'ا')
      .replace(/[ىي]/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ')
      .trim();

  const normEntered = normalizeArabic(cleanName);

  // 1. Exact match on both ID and Name
  const matched = registrants.find((r) => {
    return String(r.id).trim() === cleanId && normalizeArabic(r.name) === normEntered;
  });

  if (matched) {
    return { success: true, student: matched };
  }

  // 2. If ID matches but name is different, give helpful guidance
  const idMatch = registrants.find((r) => String(r.id).trim() === cleanId);
  if (idMatch) {
    return {
      success: false,
      error: `رقم ID موجود ولكن الاسم غير مطابق للاسم المسجل في ورقة ID registrants (${idMatch.name}).`,
    };
  }

  // 3. If Name matches but ID is different
  const nameMatch = registrants.find((r) => normalizeArabic(r.name) === normEntered);
  if (nameMatch) {
    return {
      success: false,
      error: `الاسم مسجل ولكن رقم ID غير مطابق للرقم المسجل له في ورقة (ID registrants).`,
    };
  }

  return {
    success: false,
    error: 'عفواً، لم يتم العثور على هذا الاسم والرقم في ورقة (ID registrants). تأكد من صحة البيانات.',
  };
}

/**
 * Export student records to CSV file for Excel / Google Sheets import
 */
export function exportRecordsToCSV(records: StudentSubmissionRecord[], filename = 'درجات_الطلاب_فصيح.csv') {
  if (records.length === 0) return;

  const headers = ['التاريخ والوقت', 'اسم الطالب', 'الكلمة', 'الدرجة', 'التقدير', 'ما نطق به', 'نوع التقييم', 'الملاحظات'];

  const rows = records.map((r) => [
    `"${new Date(r.timestamp).toLocaleString('ar-SA')}"`,
    `"${r.studentName || 'طالب'}"`,
    `"${r.word}"`,
    r.score,
    `"${r.grade}"`,
    `"${r.detectedWord || ''}"`,
    `"${r.engineUsed === 'ai' ? 'ذكاء اصطناعي' : 'داخلي'}"`,
    `"${(r.feedback || '').replace(/"/g, '""')}"`,
  ]);

  const BOM = '\uFEFF';
  const csvContent = BOM + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert a blob URL to a clean Base64 data URL
 */
export async function blobUrlToBase64(blobUrl: string): Promise<string> {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export interface StudentAnswerSubmissionPayload {
  studentId: string;
  studentName: string;
  lessonSubject: string;
  targetWord: string;
  detectedWord: string;
  score: number;
  grade: string;
  feedback?: string;
  audioBlobUrl?: string | null;
  audioBase64?: string | null;
  driveFolderId?: string;
  studentDriveFolderId?: string;
  wordIndex: number;
}

/**
 * Submit approved student answer to Google Sheets (Sheet: "answers 1") and upload audio to Google Drive
 */
export async function submitStudentAnswerToSheet(
  webhookUrl: string,
  payload: StudentAnswerSubmissionPayload
): Promise<{ success: boolean; audioUrl?: string; message: string }> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, message: 'رابط Google Sheets Webhook غير محدد أو غير صالح.' };
  }

  let finalBase64 = payload.audioBase64 || '';
  if (!finalBase64 && payload.audioBlobUrl) {
    try {
      finalBase64 = await blobUrlToBase64(payload.audioBlobUrl);
    } catch (e) {
      console.warn('Could not convert audio blob to base64:', e);
    }
  }

  // Ensure student audio always routes to student folder (1o80NgUVp64TwTt_yRn3I83c6gy8Ce1iA)
  const resolvedStudentFolderId =
    payload.studentDriveFolderId ||
    (payload.driveFolderId && payload.driveFolderId !== DEFAULT_DRIVE_AUDIO_FOLDER_ID
      ? payload.driveFolderId
      : STUDENT_AUDIO_DRIVE_FOLDER_ID);

  const finalGradeFeedback = (payload.feedback || payload.grade || '').trim();

  const postPayload = {
    action: 'submit_student_answer',
    studentId: payload.studentId || '',
    studentName: payload.studentName || 'طالب',
    lessonSubject: payload.lessonSubject || 'الدرس الأول',
    targetWord: payload.targetWord,
    detectedWord: payload.detectedWord || '',
    score: payload.score,
    grade: finalGradeFeedback,
    feedback: finalGradeFeedback,
    audioBase64: finalBase64,
    studentDriveFolderId: resolvedStudentFolderId,
    driveFolderId: resolvedStudentFolderId,
    wordIndex: payload.wordIndex >= 0 ? payload.wordIndex : 0,
  };

  const res = await callGoogleSheetsPost(webhookUrl, postPayload);
  return {
    success: res.success,
    audioUrl: res.data?.audioUrl,
    message:
      res.data?.message ||
      (res.success
        ? 'تم إرسال إجابتك واعتمادها بنجاح في ورقة answers 1! ✅'
        : res.error || 'تعذر الإرسال إلى Google Sheets'),
  };
}

/**
 * Fetch branding and social media configuration from sheet "الرئيسية"
 * - B2: Logo Image / Drive URL
 * - B3: Main Title
 * - B4: Subtitle / Description
 * - B8:B17 (URLs) & C8:C17 (Icons)
 */
export async function fetchHomeConfigFromSheets(webhookUrl: string): Promise<HomeBrandConfig | null> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    // Return cached if available
    try {
      const cached = localStorage.getItem('faseeh_cached_home_config');
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  }

  const cleanUrl = webhookUrl.trim();
  const targetUrl = cleanUrl.includes('?')
    ? `${cleanUrl}&action=get_home_config&_t=${Date.now()}`
    : `${cleanUrl}?action=get_home_config&_t=${Date.now()}`;

  let data: any = null;

  try {
    const proxyRes = await fetch(`/api/google-sheets?url=${encodeURIComponent(targetUrl)}`);
    if (proxyRes.ok) {
      data = await proxyRes.json().catch(() => null);
    }
  } catch (proxyErr) {
    console.warn('Proxy fetch of homeConfig failed, trying direct:', proxyErr);
  }

  if (!data || !data.homeConfig) {
    try {
      const directRes = await fetch(targetUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (directRes.ok) {
        data = await directRes.json().catch(() => null);
      }
    } catch (e) {
      console.warn('Direct fetch of homeConfig failed:', e);
    }
  }

  if (data && data.homeConfig) {
    const rawCard = data.homeConfig.card || {};
    const cardConfig = {
      cardLogoUrl: rawCard.cardLogoUrl ? normalizeDriveImageUrl(rawCard.cardLogoUrl) : '',
      cardBgUrl: rawCard.cardBgUrl ? normalizeDriveImageUrl(rawCard.cardBgUrl) : '',
      cardTitle: rawCard.cardTitle || '',
      cardSubtitle: rawCard.cardSubtitle || '',
      extraText1: rawCard.extraText1 || '',
      extraText2: rawCard.extraText2 || '',
      extraText3: rawCard.extraText3 || '',
    };

    const cfg: HomeBrandConfig = {
      logoUrl: data.homeConfig.logoUrl ? normalizeDriveImageUrl(data.homeConfig.logoUrl) : '',
      title: data.homeConfig.title || '',
      subtitle: data.homeConfig.subtitle || '',
      socialLinks: Array.isArray(data.homeConfig.socialLinks)
        ? data.homeConfig.socialLinks.filter((s: any) => s.url && s.iconKey)
        : [],
      card: cardConfig,
      adminUsers: Array.isArray(data.homeConfig.adminUsers) ? data.homeConfig.adminUsers : [],
    };

    try {
      localStorage.setItem('faseeh_cached_home_config', JSON.stringify(cfg));
    } catch {}

    return cfg;
  }

  // Fallback to local cached
  try {
    const cached = localStorage.getItem('faseeh_cached_home_config');
    if (cached) return JSON.parse(cached);
  } catch {}

  return null;
}

/**
 * Fetch evaluation and submission history specifically for the logged in student
 * from sheet "answers 1" and local storage
 */
export async function fetchStudentSubmissionsFromSheet(
  webhookUrl: string,
  studentId: string,
  studentName: string
): Promise<PracticeHistoryItem[]> {
  const resultList: PracticeHistoryItem[] = [];
  const cleanId = (studentId || '').trim();
  const cleanName = (studentName || '').trim();

  // 1. Fetch from Google Sheets "answers 1"
  if (webhookUrl && webhookUrl.trim().startsWith('http') && (cleanId || cleanName)) {
    try {
      const targetUrl = `${webhookUrl}?action=get_student_history&studentId=${encodeURIComponent(
        cleanId
      )}&studentName=${encodeURIComponent(cleanName)}&_t=${Date.now()}`;

      let data: any = null;
      try {
        const proxyRes = await fetch(`/api/google-sheets?url=${encodeURIComponent(targetUrl)}`);
        if (proxyRes.ok) data = await proxyRes.json().catch(() => null);
      } catch {}

      if (!data || !Array.isArray(data.history)) {
        try {
          const directRes = await fetch(targetUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          });
          if (directRes.ok) data = await directRes.json().catch(() => null);
        } catch {}
      }

      if (data && Array.isArray(data.history)) {
        for (const item of data.history) {
          resultList.push({
            id: item.id || `sheet-${item.word}-${item.timestamp}`,
            wordId: item.wordId || `w-${item.word}`,
            word: item.word,
            score: typeof item.score === 'number' ? item.score : parseInt(item.score) || 0,
            grade: item.grade || 'معتمد',
            timestamp: typeof item.timestamp === 'number' ? item.timestamp : Date.now(),
            spokenText: item.spokenText || '',
            recordedAudioUrl: item.recordedAudioUrl || undefined,
            studentName: item.studentName || cleanName,
          });
        }
      }
    } catch (e) {
      console.warn('Error fetching student history from Google Sheets:', e);
    }
  }

  // 2. Merge with locally cached approved student submissions for this student
  try {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (k.startsWith('faseeh_sub_')) {
        // Matches faseeh_sub_{studentId}_... or matches when studentId matches
        if (cleanId && k.startsWith(`faseeh_sub_${cleanId}_`)) {
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              const exists = resultList.some(
                (r) => r.word === parsed.targetWord && Math.abs(r.score - parsed.score) < 2
              );
              if (!exists) {
                resultList.push({
                  id: `local-${k}-${parsed.timestamp || Date.now()}`,
                  wordId: `w-${parsed.targetWord}`,
                  word: parsed.targetWord,
                  score: parsed.score || 0,
                  grade: parsed.grade || 'معتمد',
                  timestamp: parsed.timestamp || Date.now(),
                  spokenText: parsed.detectedWord || '',
                  recordedAudioUrl: parsed.audioUrl || undefined,
                  studentName: parsed.studentName || cleanName,
                });
              }
            } catch {}
          }
        }
      }
    }
  } catch {}

  // Sort by latest timestamp first
  return resultList.sort((a, b) => b.timestamp - a.timestamp);
}

export function normalizeArabicDigits(str: string): string {
  return String(str || '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

/**
 * Extract accurate percentage (0-100) from answers 2 formulaString or raw value.
 * Handles formats like:
 * - "(5 - 4 صحيح - 1 خطأ = 80%)"
 * - "(5 - الصحيح 5 - أخطاء المحاولات 2 = 71%)"
 * - "%80", "80٪", "80 %", "= 80", Arabic digits "٨٠٪", or Google Sheets decimal "0.8"
 */
export function extractPercentageFromMatchingText(text: string, rawPct?: unknown): number {
  const normalized = normalizeArabicDigits(text || '');

  // 1. Direct match like "80%", "80 %", "80٪"
  const afterPct = normalized.match(/(\d+(?:\.\d+)?)\s*[%٪]/);
  if (afterPct) {
    return Math.min(100, Math.max(0, Math.round(parseFloat(afterPct[1]))));
  }

  // 2. Prefix match like "%80" or "٪80" (common in RTL sheets)
  const beforePct = normalized.match(/[%٪]\s*(\d+(?:\.\d+)?)/);
  if (beforePct) {
    return Math.min(100, Math.max(0, Math.round(parseFloat(beforePct[1]))));
  }

  // 3. Equals / rate label match like "= 80" or "النسبة: 80"
  const eqMatch = normalized.match(/(?:=|النسبة(?:\s*التراكمية)?\s*:?)\s*(\d+(?:\.\d+)?)/);
  if (eqMatch) {
    const val = parseFloat(eqMatch[1]);
    if (val > 0 && val <= 1 && eqMatch[1].includes('.')) {
      return Math.round(val * 100);
    }
    return Math.min(100, Math.max(0, Math.round(val)));
  }

  // 4. Compute from "X صحيح" and total or "Y خطأ"
  const correctMatch = normalized.match(/(\d+)\s*صحيح|صحيح\s*(\d+)|الصحيح\s*(\d+)/);
  const wrongMatch = normalized.match(/(\d+)\s*خطأ|خطأ\s*(\d+)|الخطأ\s*(\d+)|أخطاء\s*المحاولات\s*(\d+)/);
  if (correctMatch) {
    const c = parseInt(correctMatch[1] || correctMatch[2] || correctMatch[3], 10);
    const w = wrongMatch
      ? parseInt(wrongMatch[1] || wrongMatch[2] || wrongMatch[3] || wrongMatch[4], 10)
      : 0;
    const firstNumMatch = normalized.match(/^\s*\(?\s*(\d+)/);
    const totalPairs = firstNumMatch ? parseInt(firstNumMatch[1], 10) : c + w;
    const denom = Math.max(1, c + w > totalPairs ? c + w : totalPairs);
    if (denom > 0) {
      return Math.min(100, Math.max(0, Math.round((c / denom) * 100)));
    }
  }

  // 5. Fallback to raw numeric percentage (supports decimal ratio like 0.8 from Google Sheets)
  if (typeof rawPct === 'number' && !isNaN(rawPct)) {
    if (rawPct > 0 && rawPct <= 1) return Math.round(rawPct * 100);
    return Math.min(100, Math.max(0, Math.round(rawPct)));
  }
  if (typeof rawPct === 'string' && rawPct.trim()) {
    const parsed = parseFloat(normalizeArabicDigits(rawPct));
    if (!isNaN(parsed)) {
      if (parsed > 0 && parsed <= 1 && !rawPct.includes('%') && !rawPct.includes('٪')) {
        return Math.round(parsed * 100);
      }
      return Math.min(100, Math.max(0, Math.round(parsed)));
    }
  }

  return 0;
}

/**
 * Fetch student matching exercise history from sheet "answers 2" and merge with local cache
 */
export async function fetchStudentMatchingHistory(
  webhookUrl: string,
  studentId: string,
  studentName: string
): Promise<MatchingHistoryItem[]> {
  const cleanId = (studentId || '').trim();
  const cleanName = (studentName || '').trim();
  const mergedMap = new Map<string, MatchingHistoryItem>();

  // 1. Fetch from Google Sheets "answers 2"
  if (webhookUrl && webhookUrl.trim().startsWith('http') && (cleanId || cleanName)) {
    try {
      const cleanUrl = webhookUrl.trim();
      const separator = cleanUrl.includes('?') ? '&' : '?';
      const targetUrl = `${cleanUrl}${separator}action=get_student_matching_history&studentId=${encodeURIComponent(
        cleanId
      )}&studentName=${encodeURIComponent(cleanName)}&_t=${Date.now()}`;

      let data: any = null;
      try {
        const proxyRes = await fetch(`/api/google-sheets?url=${encodeURIComponent(targetUrl)}`);
        if (proxyRes.ok) data = await proxyRes.json().catch(() => null);
      } catch {}

      if (!data || !Array.isArray(data.matchingHistory)) {
        try {
          const directRes = await fetch(targetUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          });
          if (directRes.ok) data = await directRes.json().catch(() => null);
        } catch {}
      }

      if (data && Array.isArray(data.matchingHistory)) {
        for (const item of data.matchingHistory) {
          const subj = String(item.lessonSubject || item.subjectName || '').trim();
          if (!subj) continue;
          const exercises: MatchingExerciseHistoryEntry[] = Array.isArray(item.exercises)
            ? item.exercises
                .map((ex: any) => {
                  const formulaStr = String(ex.formulaString || '').trim();
                  return {
                    exerciseNumber: Number(ex.exerciseNumber) || 1,
                    formulaString: formulaStr,
                    percentage: extractPercentageFromMatchingText(formulaStr, ex.percentage),
                  };
                })
                .sort((a: MatchingExerciseHistoryEntry, b: MatchingExerciseHistoryEntry) => a.exerciseNumber - b.exerciseNumber)
            : [];
          mergedMap.set(subj, {
            id: item.id || `ans2-${subj}`,
            timestamp: String(item.timestamp || '').trim(),
            studentId: String(item.studentId || cleanId).trim(),
            studentName: String(item.studentName || cleanName).trim(),
            lessonSubject: subj,
            completionStatus: String(item.completionStatus || '').trim(),
            exercises,
          });
        }
      }
    } catch (e) {
      console.warn('Error fetching student matching history from Google Sheets:', e);
    }
  }

  // 2. Merge with locally cached matching submissions for this student
  try {
    const cacheKey = cleanId ? `faseeh_matching_sub_${cleanId}` : 'faseeh_matching_sub_guest';
    const rawCache = localStorage.getItem(cacheKey);
    if (rawCache) {
      const localItems: MatchingHistoryItem[] = JSON.parse(rawCache);
      if (Array.isArray(localItems)) {
        for (const localItem of localItems) {
          const subj = (localItem.lessonSubject || '').trim();
          if (!subj) continue;
          const normalizedLocalExercises = (localItem.exercises || []).map((ex) => ({
            ...ex,
            percentage: extractPercentageFromMatchingText(ex.formulaString, ex.percentage),
          }));
          const existing = mergedMap.get(subj);
          if (!existing) {
            mergedMap.set(subj, {
              ...localItem,
              exercises: normalizedLocalExercises,
            });
          } else {
            // Merge any locally saved exercises that aren't in the sheet row yet
            const exMap = new Map<number, MatchingExerciseHistoryEntry>();
            for (const ex of existing.exercises) exMap.set(ex.exerciseNumber, ex);
            for (const ex of normalizedLocalExercises) {
              if (!exMap.has(ex.exerciseNumber)) {
                exMap.set(ex.exerciseNumber, ex);
              }
            }
            existing.exercises = Array.from(exMap.values()).sort(
              (a, b) => a.exerciseNumber - b.exerciseNumber
            );
            if (!existing.completionStatus && localItem.completionStatus) {
              existing.completionStatus = localItem.completionStatus;
            }
          }
        }
      }
    }
  } catch {}

  return Array.from(mergedMap.values());
}

/**
 * Fetch all student submissions summary from sheet "answers 1"
 */
export async function fetchAllSubmissionsFromSheet(webhookUrl: string): Promise<Answers1SubmissionRow[]> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return [];
  }

  const cleanUrl = webhookUrl.trim();
  const targetUrl = cleanUrl.includes('?')
    ? `${cleanUrl}&action=get_all_submissions&_t=${Date.now()}`
    : `${cleanUrl}?action=get_all_submissions&_t=${Date.now()}`;

  let data: any = null;
  try {
    const proxyRes = await fetch(`/api/google-sheets?url=${encodeURIComponent(targetUrl)}`);
    if (proxyRes.ok) data = await proxyRes.json().catch(() => null);
  } catch {}

  if (!data || !Array.isArray(data.submissions)) {
    try {
      const directRes = await fetch(targetUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (directRes.ok) data = await directRes.json().catch(() => null);
    } catch {}
  }

  if (data && Array.isArray(data.submissions)) {
    return data.submissions;
  }
  return [];
}

/**
 * Fetch all translations from Google Sheets (Sheet: "الترجمة")
 */
export async function fetchTranslationsFromSheets(webhookUrl: string): Promise<any[] | null> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) return null;
  const cleanUrl = webhookUrl.trim();
  const targetUrl = cleanUrl.includes('?')
    ? `${cleanUrl}&action=get_translations&_t=${Date.now()}`
    : `${cleanUrl}?action=get_translations&_t=${Date.now()}`;

  let data: any = null;
  try {
    const proxyRes = await fetch(`/api/google-sheets?url=${encodeURIComponent(targetUrl)}`);
    if (proxyRes.ok) data = await proxyRes.json().catch(() => null);
  } catch {}

  if (!data || !Array.isArray(data.translations)) {
    try {
      const directRes = await fetch(targetUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (directRes.ok) data = await directRes.json().catch(() => null);
    } catch {}
  }

  if (data && Array.isArray(data.translations)) {
    return data.translations;
  }
  return null;
}

/**
 * Save all translations to Google Sheets (Sheet: "الترجمة")
 */
export async function saveTranslationsToSheets(
  webhookUrl: string,
  items: any[]
): Promise<{ success: boolean; message: string }> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, message: 'رابط Google Sheets غير صالح' };
  }
  const payload = {
    action: 'save_translations',
    items: items,
  };
  const res = await callGoogleSheetsPost(webhookUrl, payload);
  return {
    success: res.success,
    message: res.success
      ? 'تم حفظ وتوثيق الترجمات بنجاح في ورقة "الترجمة" وتحديث ورقة "الرئيسية" في Google Sheets!'
      : (res.error || 'تعذر حفظ الترجمات في الشيت'),
  };
}

/**
 * Automatically create and prepare the dedicated "الترجمة" sheet in Google Sheets
 */
export async function ensureTranslationsSheet(
  webhookUrl: string,
  items?: any[]
): Promise<{ success: boolean; message: string }> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, message: 'رابط Google Sheets غير متوفر' };
  }
  const payload = {
    action: 'save_translations',
    items: items || [],
  };
  const res = await callGoogleSheetsPost(webhookUrl, payload);
  return {
    success: res.success,
    message: res.success
      ? 'تم إنشاء وتجهيز ورقة "الترجمة" بنجاح في Google Sheets!'
      : (res.error || 'تعذر إنشاء ورقة الترجمة في الشيت'),
  };
}

export const STORAGE_KEY_MATCHING_CURRICULUM = 'faseeh_matching_curriculum';

/**
 * Fetch matching exercises from sheet "وصل"
 */
export async function fetchMatchingExercisesFromSheets(
  webhookUrl?: string
): Promise<{ success: boolean; subjects: MatchingLessonSubject[]; error?: string }> {
  // If webhook is not provided, return cached or initial curriculum
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_MATCHING_CURRICULUM);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { success: true, subjects: parsed };
        }
      }
    } catch {}
    return { success: true, subjects: INITIAL_MATCHING_SUBJECTS };
  }

  try {
    const cleanUrl = webhookUrl.trim();
    const targetUrl = cleanUrl.includes('?')
      ? `${cleanUrl}&action=get_matching&_t=${Date.now()}`
      : `${cleanUrl}?action=get_matching&_t=${Date.now()}`;

    let res: any = null;
    try {
      const proxyRes = await fetch(`/api/google-sheets?url=${encodeURIComponent(targetUrl)}`);
      if (proxyRes.ok) {
        res = await proxyRes.json().catch(() => null);
      }
    } catch (proxyErr) {
      console.warn('Proxy GET matching failed, trying direct:', proxyErr);
    }

    if (!res || !res.subjects) {
      try {
        const directRes = await fetch(targetUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (directRes.ok) {
          res = await directRes.json().catch(() => null);
        }
      } catch (directErr) {
        console.warn('Direct GET matching failed:', directErr);
      }
    }

    if (res && res.success && Array.isArray(res.subjects) && res.subjects.length > 0) {
      const normalizedSubjects: MatchingLessonSubject[] = res.subjects.map((s: any, sIdx: number) => ({
        id: s.id || `subj-${sIdx + 1}`,
        subjectName: String(s.subjectName || s.subject || `الموضوع ${sIdx + 1}`).trim(),
        exercises: Array.isArray(s.exercises)
          ? s.exercises.map((ex: any, eIdx: number) => ({
              id: ex.id || `ex-${eIdx + 1}`,
              exerciseNumber: ex.exerciseNumber || eIdx + 1,
              questionText: ex.questionText || `صل الكلمات المناسبة ${eIdx + 1}`,
              pairs: Array.isArray(ex.pairs) ? ex.pairs : [],
              inputMode: ex.inputMode || 'both',
              durationSeconds: typeof ex.durationSeconds === 'number' ? ex.durationSeconds : 4,
              lockOnMistake: Boolean(ex.lockOnMistake),
              showMistakeFeedback: ex.showMistakeFeedback !== false,
              allowSmartReassign: Boolean(ex.allowSmartReassign),
              allowRetry: ex.allowRetry !== false,
            }))
          : [],
      }));

      try {
        localStorage.setItem(STORAGE_KEY_MATCHING_CURRICULUM, JSON.stringify(normalizedSubjects));
      } catch {}
      return { success: true, subjects: normalizedSubjects };
    }
  } catch (err: any) {
    console.warn('Failed to fetch matching exercises from sheets:', err);
  }

  // Fallback to cached or initial curriculum
  try {
    const cached = localStorage.getItem(STORAGE_KEY_MATCHING_CURRICULUM);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { success: true, subjects: parsed };
      }
    }
  } catch {}

  return { success: true, subjects: INITIAL_MATCHING_SUBJECTS };
}

/**
 * Format exercise settings object to readable string for Column 4 in sheet "وصل"
 * e.g. "صوت فقط | لا تراجع | إخفاء الخطأ | 4 ثواني"
 */
export function formatExerciseSettingsString(exercise: {
  inputMode?: 'voice_only' | 'both';
  durationSeconds?: number;
  lockOnMistake?: boolean;
  showMistakeFeedback?: boolean;
  allowSmartReassign?: boolean;
  allowRetry?: boolean;
}): string {
  const modeStr = exercise.inputMode === 'voice_only' ? 'صوت فقط' : 'فأرة وصوت';
  const lockStr = exercise.lockOnMistake ? 'لا تراجع' : 'إتاحة المحاولة';
  const feedbackStr = exercise.showMistakeFeedback === false ? 'إخفاء الخطأ' : 'إظهار الخطأ';
  const smartStr = exercise.allowSmartReassign ? 'تصحيح ذكي' : 'بدون تصحيح ذكي';
  const retryStr = exercise.allowRetry === false ? 'منع الإعادة' : 'السماح بالإعادة';
  const dur = typeof exercise.durationSeconds === 'number' && exercise.durationSeconds > 0 ? exercise.durationSeconds : 4;
  return `${modeStr} | ${lockStr} | ${feedbackStr} | ${smartStr} | ${retryStr} | ${dur} ثواني`;
}

/**
 * Parse Column 4 settings string from sheet "وصل" back into exercise properties
 */
export function parseExerciseSettingsString(str?: string): {
  inputMode: 'voice_only' | 'both';
  durationSeconds: number;
  lockOnMistake: boolean;
  showMistakeFeedback: boolean;
  allowSmartReassign: boolean;
  allowRetry: boolean;
} {
  const s = String(str || '').trim();
  const inputMode: 'voice_only' | 'both' = s.includes('صوت فقط') ? 'voice_only' : 'both';
  const lockOnMistake = s.includes('لا تراجع') || s.includes('قفل');
  const showMistakeFeedback = !s.includes('إخفاء');
  const allowSmartReassign =
    (s.includes('تصحيح ذكي') && !s.includes('بدون تصحيح ذكي')) ||
    s.includes('فك ذكي') ||
    s.includes('تبديل الإجابة');
  const allowRetry = !(s.includes('منع الإعادة') || s.includes('لا إعادة') || s.includes('no_retry'));
  const durMatch = s.match(/(\d+)\s*ثوان/);
  const durationSeconds = durMatch ? parseInt(durMatch[1], 10) : 4;
  return { inputMode, durationSeconds, lockOnMistake, showMistakeFeedback, allowSmartReassign, allowRetry };
}

/**
 * Save or update a matching exercise in sheet "وصل" (4 columns per exercise)
 */
export async function saveMatchingExerciseToSheets(
  webhookUrl: string,
  payload: {
    subjectName: string;
    exerciseNumber: number;
    questionText: string;
    pairs: MatchingPair[];
    inputMode?: 'voice_only' | 'both';
    durationSeconds?: number;
    lockOnMistake?: boolean;
    showMistakeFeedback?: boolean;
    allowSmartReassign?: boolean;
    allowRetry?: boolean;
  }
): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, error: 'رابط Google Sheets Webhook غير متوفر' };
  }

  const rightWords = payload.pairs.map((p) => p.rightText.trim()).filter(Boolean).join(' | ');
  const leftWords = payload.pairs.map((p) => p.leftText.trim()).filter(Boolean).join(' | ');
  const settingsString = formatExerciseSettingsString(payload);

  const postPayload = {
    action: 'save_matching_exercise',
    sheetName: 'وصل',
    subjectName: payload.subjectName.trim(),
    subject: payload.subjectName.trim(),
    exerciseNumber: payload.exerciseNumber,
    exerciseIndex: payload.exerciseNumber,
    questionText: payload.questionText.trim(),
    rightWords: rightWords,
    leftWords: leftWords,
    settingsString: settingsString,
    settings: settingsString,
  };

  const res = await callGoogleSheetsPost(webhookUrl, postPayload);
  return {
    success: res.success,
    error: res.error,
    message: res.success ? 'تم حفظ التمرين بنجاح في ورقة "وصل" بالهيكل المعتمد!' : res.error,
  };
}

/**
 * Submit student matching answer directly to sheet "answers 2"
 */
export async function submitMatchingAnswerToSheet(
  webhookUrl: string,
  payload: {
    studentId: string;
    studentName: string;
    subjectName: string;
    exerciseNumber: number;
    totalPairs: number;
    correctCount: number;
    wrongCount: number;
    percentage: number;
    totalExercisesInSubject: number;
    completedCountInSubject: number;
    overallPercentage: number;
    modeDescription?: string;
    summaryString?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, error: 'رابط Google Sheets Webhook غير متوفر' };
  }

  // Format: e.g. "(5 - 4 صحيح - 1 خطأ = 80%)" or "(5 - الصحيح 5 - أخطاء المحاولات 2 = 71%)"
  const summaryString =
    payload.summaryString ||
    `(${payload.totalPairs} - الصحيح ${payload.correctCount} - الخطأ ${payload.wrongCount} = ${payload.percentage}%)`;
  
  // Format overall status: e.g. "تم إنجاز (2 من 3 تمارين) - النسبة التراكمية: 85%"
  const completionStatus = payload.completedCountInSubject >= payload.totalExercisesInSubject
    ? `مكتمل (${payload.completedCountInSubject} من ${payload.totalExercisesInSubject} تمارين) - النسبة: ${payload.overallPercentage}%`
    : `جاري الإنجاز (${payload.completedCountInSubject} من ${payload.totalExercisesInSubject} تمارين) - النسبة التراكمية: ${payload.overallPercentage}%`;

  const timestampStr = new Date().toLocaleString('ar-SA');

  // Cache locally so the student sees their matching scores immediately in StatsModal
  try {
    const cleanId = (payload.studentId || '').trim();
    const cacheKey = cleanId ? `faseeh_matching_sub_${cleanId}` : 'faseeh_matching_sub_guest';
    const raw = localStorage.getItem(cacheKey);
    const list: MatchingHistoryItem[] = raw ? JSON.parse(raw) : [];
    const safeList = Array.isArray(list) ? list : [];
    const subjName = payload.subjectName.trim();
    const existingIdx = safeList.findIndex((item) => item.lessonSubject === subjName);
    const newEntry: MatchingExerciseHistoryEntry = {
      exerciseNumber: payload.exerciseNumber,
      formulaString: summaryString,
      percentage: payload.percentage,
    };

    if (existingIdx >= 0) {
      const existing = safeList[existingIdx];
      const filteredEx = (existing.exercises || []).filter(
        (ex) => ex.exerciseNumber !== payload.exerciseNumber
      );
      filteredEx.push(newEntry);
      filteredEx.sort((a, b) => a.exerciseNumber - b.exerciseNumber);
      safeList[existingIdx] = {
        ...existing,
        timestamp: timestampStr,
        completionStatus,
        exercises: filteredEx,
      };
    } else {
      safeList.unshift({
        id: `local-ans2-${Date.now()}`,
        timestamp: timestampStr,
        studentId: cleanId,
        studentName: payload.studentName,
        lessonSubject: subjName,
        completionStatus,
        exercises: [newEntry],
      });
    }
    localStorage.setItem(cacheKey, JSON.stringify(safeList));
  } catch {}

  const postPayload = {
    action: 'submit_matching_answer',
    sheetName: 'answers 2',
    studentId: payload.studentId,
    studentName: payload.studentName,
    subjectName: payload.subjectName,
    lessonSubject: payload.subjectName,
    exerciseNumber: payload.exerciseNumber,
    exerciseIndex: payload.exerciseNumber,
    resultFormula: summaryString,
    summaryString: summaryString,
    completionStatus: completionStatus,
    percentage: payload.percentage,
    timestamp: timestampStr,
  };

  const res = await callGoogleSheetsPost(webhookUrl, postPayload);
  return {
    success: res.success,
    error: res.error,
  };
}

/**
 * Export and populate all matching exercises and subjects directly to sheet "وصل"
 * Exact 4-Column Sheet Specification:
 * - Col A: موضوع الدرس
 * - Ex 1 (Cols B:E): B = نص السؤال | C = الكلمات في اليمين ( | ) | D = الكلمات في اليسار ( | ) | E = إعدادات التمرين
 * - Ex 2 (Cols F:I): F = نص السؤال | G = الكلمات في اليمين ( | ) | H = الكلمات في اليسار ( | ) | I = إعدادات التمرين
 * - Ex 3 (Cols J:M)... and so on!
 */
export async function exportAllMatchingCurriculumToSheets(
  webhookUrl: string,
  subjects: MatchingLessonSubject[]
): Promise<{ success: boolean; message: string; count: number }> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, message: 'رابط Google Sheets Webhook غير متوفر', count: 0 };
  }

  const formattedSubjects = subjects.map((subj) => ({
    subjectName: subj.subjectName,
    exercises: subj.exercises.map((ex) => ({
      exerciseNumber: ex.exerciseNumber,
      questionText: ex.questionText,
      rightWords: ex.pairs.map((p) => p.rightText.trim()).filter(Boolean).join(' | '),
      leftWords: ex.pairs.map((p) => p.leftText.trim()).filter(Boolean).join(' | '),
      settingsString: formatExerciseSettingsString(ex),
    })),
  }));

  const totalExercises = subjects.reduce((sum, s) => sum + s.exercises.length, 0);

  // 1. Try single atomic bulk export action (fastest and guarantees 4-column layout)
  const bulkRes = await callGoogleSheetsPost(webhookUrl, {
    action: 'export_matching_curriculum',
    sheetName: 'وصل',
    subjects: formattedSubjects,
  });

  if (bulkRes.success) {
    return {
      success: true,
      message: `تم نقل وتصدير ${subjects.length} مواضيع و ${totalExercises} تمارين بنجاح إلى ورقة (وصل) بالهيكل الجديد المعتمد (4 أعمدة لكل تمرين)!`,
      count: totalExercises,
    };
  }

  // 2. Fallback to save_matching_exercise per exercise if script is on an older version
  let savedCount = 0;
  for (const subj of subjects) {
    for (const ex of subj.exercises) {
      await saveMatchingExerciseToSheets(webhookUrl, {
        subjectName: subj.subjectName,
        exerciseNumber: ex.exerciseNumber,
        questionText: ex.questionText,
        pairs: ex.pairs,
        inputMode: ex.inputMode,
        durationSeconds: ex.durationSeconds,
        lockOnMistake: ex.lockOnMistake,
        showMistakeFeedback: ex.showMistakeFeedback,
        allowSmartReassign: ex.allowSmartReassign,
        allowRetry: ex.allowRetry,
      });
      savedCount++;
    }
  }

  return {
    success: true,
    message: `تم نقل وتصدير ${subjects.length} مواضيع و ${savedCount} تمارين إلى ورقة (وصل)!`,
    count: savedCount,
  };
}

export const STORAGE_KEY_DICTATION_CURRICULUM = 'faseeh_dictation_curriculum';

/**
 * Fetch dictation exercises from sheet "كلمات"
 */
export async function fetchDictationExercisesFromSheets(
  webhookUrl?: string
): Promise<{ success: boolean; subjects: DictationLessonSubject[]; error?: string }> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_DICTATION_CURRICULUM);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { success: true, subjects: parsed };
        }
      }
    } catch {}
    return { success: true, subjects: INITIAL_DICTATION_SUBJECTS };
  }

  try {
    const cleanUrl = webhookUrl.trim();
    const targetUrl = cleanUrl.includes('?')
      ? `${cleanUrl}&action=get_dictation&_t=${Date.now()}`
      : `${cleanUrl}?action=get_dictation&_t=${Date.now()}`;

    let res: any = null;
    try {
      const proxyRes = await fetch(`/api/google-sheets?url=${encodeURIComponent(targetUrl)}`);
      if (proxyRes.ok) {
        res = await proxyRes.json().catch(() => null);
      }
    } catch (proxyErr) {
      console.warn('Proxy GET dictation failed, trying direct:', proxyErr);
    }

    if (!res || !res.subjects) {
      try {
        const directRes = await fetch(targetUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (directRes.ok) {
          res = await directRes.json().catch(() => null);
        }
      } catch (directErr) {
        console.warn('Direct GET dictation failed:', directErr);
      }
    }

    if (res && res.success && Array.isArray(res.subjects) && res.subjects.length > 0) {
      const normalizedSubjects: DictationLessonSubject[] = res.subjects.map((s: any, sIdx: number) => ({
        id: s.id || `dict-subj-${sIdx + 1}`,
        subjectName: String(s.subjectName || s.subject || `الموضوع ${sIdx + 1}`).trim(),
        exercises: Array.isArray(s.exercises)
          ? s.exercises.map((ex: any, eIdx: number) => {
              const parsedSet = parseDictationSettingsString(ex.settingsString || ex.settings || '');
              return {
                id: ex.id || `dict-ex-${eIdx + 1}`,
                exerciseNumber: ex.exerciseNumber || eIdx + 1,
                questionText: String(ex.questionText || `رتب الحروف أو الكلمات ${eIdx + 1}`).trim(),
                scrambledPool: String(ex.scrambledPool || '').trim(),
                correctAnswer: String(ex.correctAnswer || '').trim(),
                settingsString: String(ex.settingsString || ex.settings || '').trim(),
                durationSeconds:
                  typeof ex.durationSeconds === 'number' ? ex.durationSeconds : parsedSet.durationSeconds,
                allowRetry: ex.allowRetry !== undefined ? Boolean(ex.allowRetry) : parsedSet.allowRetry,
              };
            })
          : [],
      }));

      try {
        localStorage.setItem(STORAGE_KEY_DICTATION_CURRICULUM, JSON.stringify(normalizedSubjects));
      } catch {}
      return { success: true, subjects: normalizedSubjects };
    }
  } catch (err: any) {
    console.warn('Failed to fetch dictation exercises from sheets:', err);
  }

  try {
    const cached = localStorage.getItem(STORAGE_KEY_DICTATION_CURRICULUM);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { success: true, subjects: parsed };
      }
    }
  } catch {}

  return { success: true, subjects: INITIAL_DICTATION_SUBJECTS };
}

/**
 * Save or update a single dictation exercise in sheet "كلمات"
 */
export async function saveDictationExerciseToSheets(
  webhookUrl: string,
  payload: {
    subjectName: string;
    exerciseNumber: number;
    questionText: string;
    scrambledPool: string;
    correctAnswer: string;
    durationSeconds?: number;
    allowRetry?: boolean;
  }
): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, error: 'رابط Google Sheets Webhook غير متوفر' };
  }

  const settingsString = formatDictationSettingsString(payload);
  const postPayload = {
    action: 'save_dictation_exercise',
    sheetName: 'كلمات',
    subjectName: payload.subjectName.trim(),
    subject: payload.subjectName.trim(),
    exerciseNumber: payload.exerciseNumber,
    exerciseIndex: payload.exerciseNumber,
    questionText: payload.questionText.trim(),
    scrambledPool: payload.scrambledPool.trim(),
    correctAnswer: payload.correctAnswer.trim(),
    settingsString,
    settings: settingsString,
  };

  const res = await callGoogleSheetsPost(webhookUrl, postPayload);
  return {
    success: res.success,
    error: res.error,
    message: res.success ? 'تم حفظ التمرين بنجاح في ورقة "كلمات"!' : res.error,
  };
}

/**
 * Bulk export all dictation exercises to sheet "كلمات" (4 columns per exercise)
 */
export async function exportAllDictationCurriculumToSheets(
  webhookUrl: string,
  subjects: DictationLessonSubject[]
): Promise<{ success: boolean; message: string; count: number }> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, message: 'رابط Google Sheets Webhook غير متوفر', count: 0 };
  }

  const formattedSubjects = subjects.map((subj) => ({
    subjectName: subj.subjectName,
    exercises: subj.exercises.map((ex) => ({
      exerciseNumber: ex.exerciseNumber,
      questionText: ex.questionText,
      scrambledPool: ex.scrambledPool,
      correctAnswer: ex.correctAnswer,
      settingsString: ex.settingsString || formatDictationSettingsString(ex),
    })),
  }));

  const totalExercises = subjects.reduce((sum, s) => sum + s.exercises.length, 0);

  const bulkRes = await callGoogleSheetsPost(webhookUrl, {
    action: 'export_dictation_curriculum',
    sheetName: 'كلمات',
    subjects: formattedSubjects,
  });

  if (bulkRes.success) {
    return {
      success: true,
      message: `تم تصدير ${subjects.length} مواضيع و ${totalExercises} تمارين إملاء بنجاح إلى ورقة "كلمات"!`,
      count: totalExercises,
    };
  }

  let savedCount = 0;
  for (const subj of subjects) {
    for (const ex of subj.exercises) {
      await saveDictationExerciseToSheets(webhookUrl, {
        subjectName: subj.subjectName,
        exerciseNumber: ex.exerciseNumber,
        questionText: ex.questionText,
        scrambledPool: ex.scrambledPool,
        correctAnswer: ex.correctAnswer,
        durationSeconds: ex.durationSeconds,
        allowRetry: ex.allowRetry,
      });
      savedCount++;
    }
  }

  return {
    success: true,
    message: `تم تصدير ${subjects.length} مواضيع و ${savedCount} تمارين إملاء إلى ورقة "كلمات"!`,
    count: savedCount,
  };
}

/**
 * Submit student dictation answer to sheet "answers 3" + local cache
 */
export async function submitDictationAnswerToSheet(
  webhookUrl: string,
  payload: {
    studentId: string;
    studentName: string;
    subjectName: string;
    exerciseNumber: number;
    wrongAttempts: number;
    percentage: number;
    totalExercisesInSubject: number;
    completedCountInSubject: number;
    overallPercentage: number;
    summaryString?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const summaryString =
    payload.summaryString ||
    (payload.wrongAttempts > 0
      ? `(صحيح - أخطاء التحقق ${payload.wrongAttempts} = ${payload.percentage}%)`
      : `(صحيح من أول محاولة = ${payload.percentage}%)`);

  const completionStatus =
    payload.completedCountInSubject >= payload.totalExercisesInSubject
      ? `مكتمل (${payload.completedCountInSubject} من ${payload.totalExercisesInSubject} تمارين) - النسبة: ${payload.overallPercentage}%`
      : `جاري الإنجاز (${payload.completedCountInSubject} من ${payload.totalExercisesInSubject} تمارين) - النسبة التراكمية: ${payload.overallPercentage}%`;

  const timestampStr = new Date().toLocaleString('ar-SA');

  try {
    const cleanId = (payload.studentId || '').trim();
    const cacheKey = cleanId ? `faseeh_dictation_sub_${cleanId}` : 'faseeh_dictation_sub_guest';
    const raw = localStorage.getItem(cacheKey);
    const list: DictationHistoryItem[] = raw ? JSON.parse(raw) : [];
    const safeList = Array.isArray(list) ? list : [];
    const subjName = payload.subjectName.trim();
    const existingIdx = safeList.findIndex((item) => item.lessonSubject === subjName);
    const newEntry: DictationExerciseHistoryEntry = {
      exerciseNumber: payload.exerciseNumber,
      formulaString: summaryString,
      percentage: payload.percentage,
    };

    if (existingIdx >= 0) {
      const existing = safeList[existingIdx];
      const filteredEx = (existing.exercises || []).filter(
        (ex) => ex.exerciseNumber !== payload.exerciseNumber
      );
      filteredEx.push(newEntry);
      filteredEx.sort((a, b) => a.exerciseNumber - b.exerciseNumber);
      safeList[existingIdx] = {
        ...existing,
        timestamp: timestampStr,
        completionStatus,
        exercises: filteredEx,
      };
    } else {
      safeList.unshift({
        id: `local-ans3-${Date.now()}`,
        timestamp: timestampStr,
        studentId: cleanId,
        studentName: payload.studentName,
        lessonSubject: subjName,
        completionStatus,
        exercises: [newEntry],
      });
    }
    localStorage.setItem(cacheKey, JSON.stringify(safeList));
  } catch {}

  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, error: 'رابط Google Sheets Webhook غير متوفر' };
  }

  const postPayload = {
    action: 'submit_dictation_answer',
    sheetName: 'answers 3',
    studentId: payload.studentId,
    studentName: payload.studentName,
    subjectName: payload.subjectName,
    lessonSubject: payload.subjectName,
    exerciseNumber: payload.exerciseNumber,
    exerciseIndex: payload.exerciseNumber,
    resultFormula: summaryString,
    summaryString,
    completionStatus,
    percentage: payload.percentage,
    timestamp: timestampStr,
  };

  const res = await callGoogleSheetsPost(webhookUrl, postPayload);
  return {
    success: res.success,
    error: res.error,
  };
}

/**
 * Fetch student dictation history from sheet "answers 3" and merge with local cache
 */
export async function fetchStudentDictationHistory(
  webhookUrl: string,
  studentId: string,
  studentName: string
): Promise<DictationHistoryItem[]> {
  const cleanId = (studentId || '').trim();
  const cleanName = (studentName || '').trim();
  const mergedMap = new Map<string, DictationHistoryItem>();

  if (webhookUrl && webhookUrl.trim().startsWith('http') && (cleanId || cleanName)) {
    try {
      const cleanUrl = webhookUrl.trim();
      const separator = cleanUrl.includes('?') ? '&' : '?';
      const targetUrl = `${cleanUrl}${separator}action=get_student_dictation_history&studentId=${encodeURIComponent(
        cleanId
      )}&studentName=${encodeURIComponent(cleanName)}&_t=${Date.now()}`;

      let data: any = null;
      try {
        const proxyRes = await fetch(`/api/google-sheets?url=${encodeURIComponent(targetUrl)}`);
        if (proxyRes.ok) data = await proxyRes.json().catch(() => null);
      } catch {}

      if (!data || !Array.isArray(data.dictationHistory)) {
        try {
          const directRes = await fetch(targetUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          });
          if (directRes.ok) data = await directRes.json().catch(() => null);
        } catch {}
      }

      if (data && Array.isArray(data.dictationHistory)) {
        for (const item of data.dictationHistory) {
          const subj = String(item.lessonSubject || item.subjectName || '').trim();
          if (!subj) continue;
          const exercises: DictationExerciseHistoryEntry[] = Array.isArray(item.exercises)
            ? item.exercises
                .map((ex: any) => {
                  const formulaStr = String(ex.formulaString || '').trim();
                  return {
                    exerciseNumber: Number(ex.exerciseNumber) || 1,
                    formulaString: formulaStr,
                    percentage: extractPercentageFromMatchingText(formulaStr, ex.percentage),
                  };
                })
                .sort(
                  (a: DictationExerciseHistoryEntry, b: DictationExerciseHistoryEntry) =>
                    a.exerciseNumber - b.exerciseNumber
                )
            : [];
          mergedMap.set(subj, {
            id: item.id || `ans3-${subj}`,
            timestamp: String(item.timestamp || '').trim(),
            studentId: String(item.studentId || cleanId).trim(),
            studentName: String(item.studentName || cleanName).trim(),
            lessonSubject: subj,
            completionStatus: String(item.completionStatus || '').trim(),
            exercises,
          });
        }
      }
    } catch (e) {
      console.warn('Error fetching student dictation history from Google Sheets:', e);
    }
  }

  try {
    const cacheKey = cleanId ? `faseeh_dictation_sub_${cleanId}` : 'faseeh_dictation_sub_guest';
    const rawCache = localStorage.getItem(cacheKey);
    if (rawCache) {
      const localItems: DictationHistoryItem[] = JSON.parse(rawCache);
      if (Array.isArray(localItems)) {
        for (const localItem of localItems) {
          const subj = (localItem.lessonSubject || '').trim();
          if (!subj) continue;
          const normalizedLocalExercises = (localItem.exercises || []).map((ex) => ({
            ...ex,
            percentage: extractPercentageFromMatchingText(ex.formulaString, ex.percentage),
          }));
          const existing = mergedMap.get(subj);
          if (!existing) {
            mergedMap.set(subj, {
              ...localItem,
              exercises: normalizedLocalExercises,
            });
          } else {
            const exMap = new Map<number, DictationExerciseHistoryEntry>();
            for (const ex of existing.exercises) exMap.set(ex.exerciseNumber, ex);
            for (const ex of normalizedLocalExercises) {
              if (!exMap.has(ex.exerciseNumber)) {
                exMap.set(ex.exerciseNumber, ex);
              }
            }
            existing.exercises = Array.from(exMap.values()).sort(
              (a, b) => a.exerciseNumber - b.exerciseNumber
            );
            if (!existing.completionStatus && localItem.completionStatus) {
              existing.completionStatus = localItem.completionStatus;
            }
          }
        }
      }
    }
  } catch {}

  return Array.from(mergedMap.values());
}

/**
 * Complete Google Apps Script Template Code
 * Supports:
 * - Sheet "الدروس" with horizontal lessons:
 *   - Col A: موضوع الدرس
 *   - Col B:I: النص الأول (8 أعمدة: الفئة | الصورة | الصوت | القراءة الآلية | نص الدرس | المعنى | المخرج | التكرار)
 *   - Col J:Q: النص الثاني (8 أعمدة)
 *   - Col R:Y: النص الثالث (8 أعمدة)
 *   - Col Z:AG: النص الرابع (8 أعمدة)... وهكذا بلا حدود!
 * - Sheet "answers 1" with horizontal student responses:
 *   - Col A: وقت الارسال
 *   - Col B: ID المشترك
 *   - Col C: اسم المشترك
 *   - Col D: موضوع الدرس
 *   - Col E: محجوز
 *   - Col F:J: الإجابة الأولى (الكلمة المستهدفة | النص المنطوق | رابط ملف الصوت | الدرجة % | التقدير)
 *   - Col K:O: الإجابة الثانية (5 أعمدة في نفس الصف)
 *   - Col P:T: الإجابة الثالثة... وهكذا!
 * - Sheet "ID registrants" for student IDs and names
 * - Automatic saving of recorded audio directly into user's Google Drive folder
 */
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * كود Google Apps Script المتكامل لمنصة (فصيح)
 * ----------------------------------------------------
 * هيكل ورقة "الدروس" المعتمد:
 * العامود A: موضوع الدرس
 * النص الأول (B:I):
 *   B: الفئة | C: الصورة | D: الصوت | E: قراءة آلية | F: نص الدرس | G: المعنى | H: المخرج | I: التكرار
 * النص الثاني (J:Q):
 *   J: الفئة | K: الصورة | L: الصوت | M: قراءة آلية | N: نص الدرس | O: المعنى | P: المخرج | Q: التكرار
 * النص الثالث (R:Y):
 *   R: الفئة | S: الصورة | T: الصوت | U: قراءة آلية | V: نص الدرس | W: المعنى | X: المخرج | Y: التكرار
 * النص الرابع (Z:AG)... وهكذا لكل تمرين 8 أعمدة في نفس صف الدرس!
 *
 * يتم حفظ الأصوات تلقائياً داخل مجلد (فصيح_أصوات_الدروس) في Google Drive الخاص بك!
 */

/**
 * -----------------------------------------------------------------------
 * خطوة تفويض الصلاحيات (Authorization) - لمرة واحدة فقط:
 * إذا ظهر لك أي تنبيه يخص صلاحيات Google Drive أو Sheets:
 * 1. افتح محرر السكربت من الشيت: Extensions -> Apps Script
 * 2. اختر دالة authorizePermissions من القائمة المنسدلة بالأعلى
 * 3. اضغط على زر "تشغيل / Run"
 * 4. ستفتح نافذة جوجل لمنح الإذن لـ Google Drive والشيت: اضغط Review Permissions ثم اضغط Allow.
 * 5. اضغط على Deploy -> Manage Deployments -> أيقونة القلم (Edit) -> اختر New Version -> ثم اضغط Deploy.
 * -----------------------------------------------------------------------
 */
function authorizePermissions() {
  var root = DriveApp.getRootFolder();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // إنشاء مجلد تجريبي ومسحه للتأكد من تفويض صلاحيات الإنشاء والكتابة الكاملة
  var testFolder = DriveApp.createFolder("فصيح_أصوات_الدروس");
  var testFile = testFolder.createFile("test_auth.txt", "OK");
  testFile.setTrashed(true);
  Logger.log("تم تفويض Google Drive بنجاح: " + root.getName());
  Logger.log("تم تفويض Google Sheets بنجاح: " + ss.getName());
}

function getOrCreateAudioFolder(folderId) {
  // 1. إذا أدخل المعلم معرف مجلد خاص به في Google Drive
  if (folderId && typeof folderId === "string") {
    var fId = folderId.trim();
    if (fId.length > 15) {
      try {
        var customFolder = DriveApp.getFolderById(fId);
        return customFolder;
      } catch (e) {
        Logger.log("Folder by id inaccessible, fallback to auto folder: " + e);
      }
    }
  }

  // 2. البحث عن مجلد "فصيح_أصوات_الدروس" في درايف المعلم نفسه (ملفاتي) أو إنشاؤه تلقائياً
  try {
    var folders = DriveApp.getFoldersByName("فصيح_أصوات_الدروس");
    if (folders.hasNext()) {
      return folders.next();
    }
    var created = DriveApp.createFolder("فصيح_أصوات_الدروس");
    try {
      created.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {}
    return created;
  } catch (err) {
    Logger.log("Fallback to root folder: " + err);
    // 3. المجلد الجذري (ملفاتي) كخيار بديل نهائي مضمون 100%
    return DriveApp.getRootFolder();
  }
}

// دالة مساعدة لإنشاء أو استرجاع ورقة "الرئيسية" للتحكم بالشعار والعنوان والوصف وروابط التواصل
function getHomeSheet(ss) {
  var sheet = ss.getSheetByName("الرئيسية");
  if (!sheet) {
    var all = ss.getSheets();
    for (var i = 0; i < all.length; i++) {
      if (all[i].getName().trim() === "الرئيسية") {
        return all[i];
      }
    }
    sheet = ss.insertSheet("الرئيسية");
    sheet.getRange(1, 1, 1, 3).setValues([["عنصر الواجهة", "القيمة / الرابط (B)", "اسم الأيقونة (C)"]])
      .setBackground("#0c3868").setFontColor("#ffffff").setFontWeight("bold");
    sheet.getRange(2, 1, 1, 3).setValues([["شعار المنصة (رابط صورة أو Drive)", "", ""]]);
    sheet.getRange(3, 1, 1, 3).setValues([["عنوان المنصة الرئيسي", "فَصِيح — منصة تدريب وتقييم النطق ومخارج الحروف العربية", ""]]);
    sheet.getRange(4, 1, 1, 3).setValues([["الوصف التعريفي", "برنامج تعليمي متكامل لضبط وتجويد نطق الحروف والكلمات العربية، يجمع بين دقة التفريغ الصوتي والمقارنة الفيزيائية مع صوت المعلم.", ""]]);
    
    sheet.getRange(6, 1, 1, 3).setValues([["حسابات ومواقع التواصل (10 خانات)", "رابط المنصة / الصفحة (B)", "اسم الأيقونة (C: مطلوب للظهور)"]])
      .setBackground("#047857").setFontColor("#ffffff").setFontWeight("bold");
    sheet.getRange(7, 1, 1, 3).setValues([["الرقم (#)", "رابط المنصة (URL)", "اسم الأيقونة (line / facebook / instagram / youtube)"]])
      .setBackground("#e6f4ea").setFontWeight("bold");
      
    var defaultSocials = [
      ["1", "", "line"],
      ["2", "", "facebook"],
      ["3", "", "instagram"],
      ["4", "", "youtube"],
      ["5", "", ""],
      ["6", "", ""],
      ["7", "", ""],
      ["8", "", ""],
      ["9", "", ""],
      ["10", "", ""]
    ];
    sheet.getRange(8, 1, 10, 3).setValues(defaultSocials);

    // بطاقة الصفحة الرئيسية (B21:B27)
    sheet.getRange(19, 1, 1, 3).setValues([["بطاقة الصفحة الرئيسية (B21:B27)", "القيمة / الرابط (B)", "ملاحظات"]])
      .setBackground("#4338ca").setFontColor("#ffffff").setFontWeight("bold");
    sheet.getRange(20, 1, 1, 3).setValues([["البيان", "القيمة / الرابط", "التفاصيل"]])
      .setBackground("#e0e7ff").setFontWeight("bold");
    sheet.getRange(21, 1, 1, 3).setValues([["رابط صورة شعار البطاقة", "", "رابط صورة أو Drive"]]);
    sheet.getRange(22, 1, 1, 3).setValues([["رابط صورة خلفية البطاقة", "", "رابط صورة أو GIF متحرك أو Drive"]]);
    sheet.getRange(23, 1, 1, 3).setValues([["عنوان البطاقة الرئيسي", "فَصِيح — منصة تدريب وتقييم النطق ومخارج الحروف العربية", "نص العنوان الرئيسي للبطاقة"]]);
    sheet.getRange(24, 1, 1, 3).setValues([["النص الوصفي للبطاقة", "برنامج تعليمي متكامل لضبط وتجويد نطق الحروف والكلمات العربية، يجمع بين دقة التفريغ الصوتي والمقارنة الفيزيائية مع صوت المعلم.", "الوصف التعريفي للبطاقة"]]);
    sheet.getRange(25, 1, 1, 3).setValues([["نص إضافي 1", "", "اختياري"]]);
    sheet.getRange(26, 1, 1, 3).setValues([["نص إضافي 2", "", "اختياري"]]);
    sheet.getRange(27, 1, 1, 3).setValues([["نص إضافي 3", "", "اختياري"]]);

    try {
      sheet.setColumnWidth(1, 230);
      sheet.setColumnWidth(2, 380);
      sheet.setColumnWidth(3, 220);
    } catch(wErr) {}
  }
  return sheet;
}

// دالة قراءة بيانات ورقة "الرئيسية"
function readHomeConfig(ss) {
  try {
    var hSheet = ss.getSheetByName("الرئيسية");
    if (!hSheet) return null;
    var logoUrl = String(hSheet.getRange(2, 2).getValue() || "").trim();
    var title = String(hSheet.getRange(3, 2).getValue() || "").trim();
    var subtitle = String(hSheet.getRange(4, 2).getValue() || "").trim();
    
    var socialLinks = [];
    var maxSocialRow = Math.min(hSheet.getLastRow(), 18);
    if (maxSocialRow >= 8) {
      var rows = hSheet.getRange(8, 2, maxSocialRow - 7, 2).getValues();
      for (var s = 0; s < rows.length; s++) {
        var url = String(rows[s][0] || "").trim();
        var iconKey = String(rows[s][1] || "").trim().toLowerCase();
        // شرط المستخدم: إذا كان يوجد رابط ولم يتم وضع أيقونة لا تظهر! تظهر فقط إذا وُجد الرابط واسم الأيقونة
        if (url && iconKey) {
          socialLinks.push({
            url: url,
            iconKey: iconKey
          });
        }
      }
    }

    // بطاقة الصفحة الرئيسية B21:B27
    var cardLogoUrl = String(hSheet.getRange(21, 2).getValue() || "").trim();
    var cardBgUrl = String(hSheet.getRange(22, 2).getValue() || "").trim();
    var cardTitle = String(hSheet.getRange(23, 2).getValue() || "").trim();
    var cardSubtitle = String(hSheet.getRange(24, 2).getValue() || "").trim();
    var extraText1 = String(hSheet.getRange(25, 2).getValue() || "").trim();
    var extraText2 = String(hSheet.getRange(26, 2).getValue() || "").trim();
    var extraText3 = String(hSheet.getRange(27, 2).getValue() || "").trim();

    var cardConfig = {
      cardLogoUrl: cardLogoUrl,
      cardBgUrl: cardBgUrl,
      cardTitle: cardTitle,
      cardSubtitle: cardSubtitle,
      extraText1: extraText1,
      extraText2: extraText2,
      extraText3: extraText3
    };

    // D2:F31: مخصص لأسماء الإداريين وأرقام الدخول وحالة منع الدخول (إذا كانت "لا" يمنع الدخول فوراً)
    var adminUsers = [];
    try {
      var adminValues = hSheet.getRange(2, 4, 30, 3).getValues(); // Cols D, E, F (Rows 2 to 31)
      for (var a = 0; a < adminValues.length; a++) {
        var aName = String(adminValues[a][0] || "").trim();
        var aPin = String(adminValues[a][1] || "").trim();
        var aBlock = String(adminValues[a][2] || "").trim();
        var isBlocked = (aBlock === "لا" || aBlock.toLowerCase() === "no" || aBlock === "ممنوع" || aBlock === "نعم منع");
        if (aName && aPin) {
          adminUsers.push({
            name: aName,
            pin: aPin,
            blocked: isBlocked
          });
        }
      }
    } catch(adErr) {}

    return {
      logoUrl: logoUrl,
      title: title,
      subtitle: subtitle,
      socialLinks: socialLinks,
      card: cardConfig,
      adminUsers: adminUsers
    };
  } catch(e) {
    return null;
  }
}

// دالة قراءة الترجمات من ورقة "الترجمة"
function readTranslations(ss) {
  try {
    var tSheet = ss.getSheetByName("الترجمة") || ss.getSheetByName("Translations");
    if (!tSheet || tSheet.getLastRow() <= 1) return [];
    var data = tSheet.getRange(2, 1, tSheet.getLastRow() - 1, 5).getValues();
    var list = [];
    for (var i = 0; i < data.length; i++) {
      var id = String(data[i][0] || "").trim();
      if (id) {
        list.push({
          id: id,
          category: String(data[i][1] || "home").trim(),
          ar: String(data[i][2] || "").trim(),
          th: String(data[i][3] || "").trim(),
          en: String(data[i][4] || "").trim()
        });
      }
    }
    return list;
  } catch(e) {
    return [];
  }
}

// دالة مساعدة للتأكد التلقائي وتوليد كافة عناوين الأعمدة في ورقة "الدروس" مهما زاد عدد الأعمدة أفقياً
function ensureLessonsHeaders(sheet, maxColNeeded) {
  try {
    var col1 = sheet.getRange(1, 1).getValue();
    if (!col1) {
      sheet.getRange(1, 1).setValue("موضوع الدرس").setBackground("#0c3868").setFontColor("#ffffff").setFontWeight("bold");
    }
    var targetColMax = Math.max(sheet.getLastColumn(), maxColNeeded || 9);
    var totalBlocks = Math.ceil((targetColMax - 1) / 8);
    for (var k = 1; k <= totalBlocks; k++) {
      var startC = 2 + (k - 1) * 8;
      if (sheet.getMaxColumns() < startC + 7) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(), (startC + 7) - sheet.getMaxColumns());
      }
      var hVal = sheet.getRange(1, startC).getValue();
      if (!hVal) {
        var blockHeaders = [
          "الفئة " + k,
          "رابط الصورة " + k,
          "رابط الصوت " + k,
          "نص للقراءة الآلية " + k,
          "نص الدرس " + k,
          "المعنى والتوضيح " + k,
          "إرشادات المخرج " + k,
          "عدد التكرار " + k
        ];
        sheet.getRange(1, startC, 1, 8).setValues([blockHeaders])
          .setBackground("#e6f4ea")
          .setFontColor("#065f46")
          .setFontWeight("bold");
      }
    }
  } catch (err) {
    Logger.log("ensureLessonsHeaders note: " + err);
  }
}

// دالة مساعدة للتأكد التلقائي وتوليد كافة عناوين الأعمدة في ورقة "answers 1" مهما زاد عدد الإجابات أفقياً
function ensureAnswersHeaders(sheet, maxColNeeded) {
  try {
    var col1 = sheet.getRange(1, 1).getValue();
    if (!col1) {
      var baseHeaders = ["وقت الارسال", "ID المشترك", "اسم المشترك", "موضوع الدرس", "حالة الإنجاز"];
      sheet.getRange(1, 1, 1, 5).setValues([baseHeaders])
        .setBackground("#047857")
        .setFontColor("#ffffff")
        .setFontWeight("bold");
    }
    var targetColMax = Math.max(sheet.getLastColumn(), maxColNeeded || 10);
    var totalBlocks = Math.ceil((targetColMax - 5) / 5);
    for (var k = 1; k <= totalBlocks; k++) {
      var startC = 6 + (k - 1) * 5;
      if (sheet.getMaxColumns() < startC + 4) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(), (startC + 4) - sheet.getMaxColumns());
      }
      var hVal = sheet.getRange(1, startC).getValue();
      if (!hVal) {
        var blockHeaders = [
          "الكلمة المستهدفة " + k,
          "النص المنطوق " + k,
          "رابط ملف الصوت " + k,
          "الدرجة " + k + " (%)",
          "التقدير " + k
        ];
        sheet.getRange(1, startC, 1, 5).setValues([blockHeaders])
          .setBackground("#e6f4ea")
          .setFontColor("#065f46")
          .setFontWeight("bold");
      }
    }
  } catch (err) {
    Logger.log("ensureAnswersHeaders note: " + err);
  }
}

// دالة مساعدة ذكية للعثور على ورقة الدروس وتجنب أي خطأ في التسمية
function getLessonsSheet(ss) {
  var sheet = ss.getSheetByName("الدروس");
  if (!sheet) {
    var all = ss.getSheets();
    for (var i = 0; i < all.length; i++) {
      var name = all[i].getName().trim();
      if (name === "الدروس" || name === "دروس") {
        sheet = all[i];
        break;
      }
    }
    if (!sheet) {
      try {
        sheet = ss.insertSheet("الدروس");
      } catch(e) {
        for (var j = 0; j < all.length; j++) {
          if (all[j].getName().indexOf("سجل") === -1 && all[j].getName().indexOf("نتائج") === -1) {
            sheet = all[j];
            break;
          }
        }
        if (!sheet) sheet = all[0];
      }
    }
  }
  ensureLessonsHeaders(sheet, 33);
  return sheet;
}

// دالة مساعدة لإنشاء أو استرجاع ورقة المشتركين "ID registrants"
function getIDRegistrantsSheet(ss) {
  var sheet = ss.getSheetByName("ID registrants");
  if (!sheet) {
    sheet = ss.insertSheet("ID registrants");
    sheet.appendRow(["ID", "اسم المشترك"]);
    sheet.getRange(1, 1, 1, 2).setBackground("#0c3868").setFontColor("#ffffff").setFontWeight("bold");
    sheet.appendRow(["1001", "أحمد علي"]);
  }
  return sheet;
}

// دالة مساعدة لإنشاء أو استرجاع ورقة إجابات الطلاب الأفقية "answers 1"
function getAnswers1Sheet(ss) {
  var sheet = ss.getSheetByName("answers 1");
  if (!sheet) {
    var all = ss.getSheets();
    for (var i = 0; i < all.length; i++) {
      if (all[i].getName().trim().toLowerCase() === "answers 1") {
        sheet = all[i];
        break;
      }
    }
    if (!sheet) {
      sheet = ss.insertSheet("answers 1");
    }
  }
  ensureAnswersHeaders(sheet, 25);
  return sheet;
}

// دالة مساعدة لإنشاء أو استرجاع ورقة أسئلة تمرين الوصل "وصل" (4 أعمدة لكل تمرين)
function getMatchingSheet(ss) {
  var sheet = ss.getSheetByName("وصل");
  if (!sheet) {
    var all = ss.getSheets();
    for (var i = 0; i < all.length; i++) {
      if (all[i].getName().trim() === "وصل") {
        sheet = all[i];
        break;
      }
    }
    if (!sheet) {
      sheet = ss.insertSheet("وصل");
      var headers = ["موضوع الدرس"];
      for (var ex = 1; ex <= 10; ex++) {
        headers.push("السؤال " + ex);
        headers.push("الكلمات في اليمين " + ex + " ( | )");
        headers.push("الكلمات في اليسار " + ex + " ( | )");
        headers.push("إعدادات التمرين " + ex);
      }
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setBackground("#6b21a8").setFontColor("#ffffff").setFontWeight("bold");
    }
  }
  return sheet;
}

// دالة مساعدة لإنشاء أو استرجاع ورقة إجابات تمرين الوصل "answers 2"
function getAnswers2Sheet(ss) {
  var sheet = ss.getSheetByName("answers 2");
  if (!sheet) {
    var all = ss.getSheets();
    for (var i = 0; i < all.length; i++) {
      if (all[i].getName().trim().toLowerCase() === "answers 2") {
        sheet = all[i];
        break;
      }
    }
    if (!sheet) {
      sheet = ss.insertSheet("answers 2");
      var headers = ["وقت الإرسال", "ID المشترك", "اسم المشترك", "موضوع الدرس", "حالة الإنجاز"];
      for (var ex = 1; ex <= 20; ex++) {
        headers.push("تمرين " + ex);
      }
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setBackground("#581c87").setFontColor("#ffffff").setFontWeight("bold");
    }
  }
  return sheet;
}

// دالة مساعدة لإنشاء أو استرجاع ورقة أسئلة التمرين الثالث "كلمات" (4 أعمدة لكل تمرين)
function getWordsSheet(ss) {
  var sheet = ss.getSheetByName("كلمات");
  if (!sheet) {
    var all = ss.getSheets();
    for (var i = 0; i < all.length; i++) {
      if (all[i].getName().trim() === "كلمات") {
        sheet = all[i];
        break;
      }
    }
    if (!sheet) {
      sheet = ss.insertSheet("كلمات");
      var headers = ["موضوع الدرس"];
      for (var ex = 1; ex <= 10; ex++) {
        headers.push("السؤال " + ex);
        headers.push("الحروف والكلمات المشتتة " + ex);
        headers.push("الإجابة الصحيحة " + ex);
        headers.push("الإعدادات " + ex);
      }
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setBackground("#0f766e").setFontColor("#ffffff").setFontWeight("bold");
    }
  }
  return sheet;
}

// دالة مساعدة لإنشاء أو استرجاع ورقة إجابات التمرين الثالث "answers 3"
function getAnswers3Sheet(ss) {
  var sheet = ss.getSheetByName("answers 3");
  if (!sheet) {
    var all = ss.getSheets();
    for (var i = 0; i < all.length; i++) {
      if (all[i].getName().trim().toLowerCase() === "answers 3") {
        sheet = all[i];
        break;
      }
    }
    if (!sheet) {
      sheet = ss.insertSheet("answers 3");
      var headers = ["وقت الإرسال", "ID المشترك", "اسم المشترك", "موضوع الدرس", "حالة الإنجاز"];
      for (var ex = 1; ex <= 20; ex++) {
        headers.push("تمرين " + ex);
      }
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setBackground("#115e59").setFontColor("#ffffff").setFontWeight("bold");
    }
  }
  return sheet;
}

// 1. GET: جلب الدروس، أو بيانات ورقة الرئيسية، أو المشتركين، أو سجل إجابات الطالب من answers 1
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // (أ) إذا كان الطلب جلب بيانات ورقة "الرئيسية" (الشعار والعنوان والوصف وحسابات التواصل)
    if (e && e.parameter && e.parameter.action === "get_home_config") {
      var hConfig = readHomeConfig(ss);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        homeConfig: hConfig
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // (ب) إذا كان الطلب جلب سجل تقييمات وإجابات طالب معين من ورقة "answers 1"
    if (e && e.parameter && e.parameter.action === "get_student_history") {
      var ansSheet = getAnswers1Sheet(ss);
      var qId = String(e.parameter.studentId || "").trim();
      var qName = String(e.parameter.studentName || "").trim();
      var lastR = ansSheet.getLastRow();
      var lastC = Math.max(5, ansSheet.getLastColumn());
      var historyList = [];
      
      if (lastR > 1) {
        var dataRows = ansSheet.getRange(2, 1, lastR - 1, lastC).getValues();
        for (var r = 0; r < dataRows.length; r++) {
          var row = dataRows[r];
          var rowId = String(row[1] || "").trim();
          var rowName = String(row[2] || "").trim();
          var rowSubj = String(row[3] || "").trim();
          var rowTime = String(row[0] || "").trim();
          
          var match = (qId && rowId === qId) || (qName && rowName === qName);
          if (match) {
            // استخراج حزم التمارين الأفقية المكونة من 5 أعمدة
            for (var c = 5; c < row.length; c += 5) {
              var word = String(row[c] || "").trim();
              if (word) {
                var spoken = String(row[c + 1] || "").trim();
                var audio = String(row[c + 2] || "").trim();
                var scoreRaw = String(row[c + 3] || "").replace(/[^0-9]/g, '');
                var grade = String(row[c + 4] || "").trim();
                historyList.push({
                  id: "ans-r" + (r + 2) + "-c" + c,
                  wordId: "w-" + word,
                  word: word,
                  spokenText: spoken,
                  recordedAudioUrl: audio || undefined,
                  score: scoreRaw ? parseInt(scoreRaw) : 0,
                  grade: grade || "معتمد",
                  timestamp: rowTime ? (new Date(rowTime).getTime() || Date.now()) : Date.now(),
                  studentName: rowName || qName,
                  lessonSubject: rowSubj
                });
              }
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        studentId: qId,
        studentName: qName,
        history: historyList
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // (ب-2) إذا كان الطلب جلب سجل درجات تمرين التوصيل لطالب معين من ورقة "answers 2"
    if (e && e.parameter && e.parameter.action === "get_student_matching_history") {
      var a2Sheet = getAnswers2Sheet(ss);
      var qId = String(e.parameter.studentId || "").trim();
      var qName = String(e.parameter.studentName || "").trim();
      var lastR = a2Sheet.getLastRow();
      var lastC = Math.max(6, a2Sheet.getLastColumn());
      var matchingList = [];

      if (lastR > 1) {
        var dataRows = a2Sheet.getRange(2, 1, lastR - 1, lastC).getValues();
        for (var r = 0; r < dataRows.length; r++) {
          var row = dataRows[r];
          var rowTime = String(row[0] || "").trim();
          var rowId = String(row[1] || "").trim();
          var rowName = String(row[2] || "").trim();
          var rowSubj = String(row[3] || "").trim();
          var rowStatus = String(row[4] || "").trim();

          var isMatch = (qId && rowId === qId) || (qName && rowName === qName);
          if (isMatch && rowSubj) {
            var exercisesArr = [];
            for (var c = 5; c < row.length; c++) {
              var cellRaw = row[c];
              var cellStr = String(cellRaw || "").trim();
              if (cellStr) {
                var normCell = cellStr.replace(/[٠-٩]/g, function(d) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(d)); });
                var pctMatch = normCell.match(/(\d+(?:\.\d+)?)\s*[%٪]/) || normCell.match(/[%٪]\s*(\d+(?:\.\d+)?)/) || normCell.match(/=\s*(\d+(?:\.\d+)?)/);
                var pctVal = 0;
                if (pctMatch) {
                  pctVal = Math.round(parseFloat(pctMatch[1]));
                } else if (typeof cellRaw === "number" && cellRaw > 0 && cellRaw <= 1) {
                  pctVal = Math.round(cellRaw * 100);
                }
                exercisesArr.push({
                  exerciseNumber: (c - 5) + 1,
                  formulaString: cellStr,
                  percentage: pctVal
                });
              }
            }
            matchingList.push({
              id: "ans2-r" + (r + 2),
              timestamp: rowTime,
              studentId: rowId || qId,
              studentName: rowName || qName,
              lessonSubject: rowSubj,
              completionStatus: rowStatus,
              exercises: exercisesArr
            });
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        studentId: qId,
        studentName: qName,
        matchingHistory: matchingList
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // (ب-3) إذا كان الطلب جلب سجل درجات تمرين الإملاء لطالب معين من ورقة "answers 3"
    if (e && e.parameter && e.parameter.action === "get_student_dictation_history") {
      var a3Sheet = getAnswers3Sheet(ss);
      var qId = String(e.parameter.studentId || "").trim();
      var qName = String(e.parameter.studentName || "").trim();
      var lastR = a3Sheet.getLastRow();
      var lastC = Math.max(6, a3Sheet.getLastColumn());
      var dictList = [];

      if (lastR > 1) {
        var dataRows = a3Sheet.getRange(2, 1, lastR - 1, lastC).getValues();
        for (var r = 0; r < dataRows.length; r++) {
          var row = dataRows[r];
          var rowTime = String(row[0] || "").trim();
          var rowId = String(row[1] || "").trim();
          var rowName = String(row[2] || "").trim();
          var rowSubj = String(row[3] || "").trim();
          var rowStatus = String(row[4] || "").trim();

          var isMatch = (qId && rowId === qId) || (qName && rowName === qName);
          if (isMatch && rowSubj) {
            var exercisesArr = [];
            for (var c = 5; c < row.length; c++) {
              var cellRaw = row[c];
              var cellStr = String(cellRaw || "").trim();
              if (cellStr) {
                var normCell = cellStr.replace(/[٠-٩]/g, function(d) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(d)); });
                var pctMatch = normCell.match(/(\d+(?:\.\d+)?)\s*[%٪]/) || normCell.match(/[%٪]\s*(\d+(?:\.\d+)?)/) || normCell.match(/=\s*(\d+(?:\.\d+)?)/);
                var pctVal = 0;
                if (pctMatch) {
                  pctVal = Math.round(parseFloat(pctMatch[1]));
                } else if (typeof cellRaw === "number" && cellRaw > 0 && cellRaw <= 1) {
                  pctVal = Math.round(cellRaw * 100);
                }
                exercisesArr.push({
                  exerciseNumber: (c - 5) + 1,
                  formulaString: cellStr,
                  percentage: pctVal
                });
              }
            }
            dictList.push({
              id: "ans3-r" + (r + 2),
              timestamp: rowTime,
              studentId: rowId || qId,
              studentName: rowName || qName,
              lessonSubject: rowSubj,
              completionStatus: rowStatus,
              exercises: exercisesArr
            });
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        studentId: qId,
        studentName: qName,
        dictationHistory: dictList
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // (ج) إذا كان الطلب جلب قائمة المشتركين من ورقة "ID registrants"
    if (e && e.parameter && e.parameter.action === "get_registrants") {
      var regSheet = getIDRegistrantsSheet(ss);
      var lastR = regSheet.getLastRow();
      var registrants = [];
      if (lastR > 1) {
        var vals = regSheet.getRange(2, 1, lastR - 1, 2).getValues();
        for (var i = 0; i < vals.length; i++) {
          var rId = String(vals[i][0] || "").trim();
          var rName = String(vals[i][1] || "").trim();
          if (rId && rName && rId !== "ID") {
            registrants.push({ id: rId, name: rName });
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, registrants: registrants }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // (ج-2) إذا كان الطلب جلب ملخص نتائج إجابات الطلاب من ورقة "answers 1"
    if (e && e.parameter && e.parameter.action === "get_all_submissions") {
      var ansSheet = getAnswers1Sheet(ss);
      var lastR = ansSheet.getLastRow();
      var lastC = Math.max(5, ansSheet.getLastColumn());
      var submissionsList = [];
      if (lastR > 1) {
        var dataRows = ansSheet.getRange(2, 1, lastR - 1, lastC).getValues();
        for (var r = 0; r < dataRows.length; r++) {
          var row = dataRows[r];
          var rowTime = String(row[0] || "").trim();
          var rowId = String(row[1] || "").trim();
          var rowName = String(row[2] || "").trim();
          var rowSubj = String(row[3] || "").trim();
          var rowStatus = String(row[4] || "").trim();
          
          if (rowId || rowName || rowSubj) {
            var exercises = [];
            for (var c = 5; c < row.length; c += 5) {
              var word = String(row[c] || "").trim();
              if (word) {
                var spoken = String(row[c + 1] || "").trim();
                var audio = String(row[c + 2] || "").trim();
                var scoreRaw = String(row[c + 3] || "").replace(/[^0-9]/g, '');
                var grade = String(row[c + 4] || "").trim();
                exercises.push({
                  word: word,
                  spokenText: spoken,
                  audioUrl: audio,
                  score: scoreRaw ? parseInt(scoreRaw) : 0,
                  grade: grade
                });
              }
            }
            submissionsList.push({
              rowIndex: r + 2,
              timestamp: rowTime,
              studentId: rowId,
              studentName: rowName,
              lessonSubject: rowSubj,
              status: rowStatus,
              totalExercises: exercises.length,
              exercises: exercises
            });
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        submissions: submissionsList
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // (ج-3) إذا كان الطلب جلب الترجمات من ورقة "الترجمة"
    if (e && e.parameter && e.parameter.action === "get_translations") {
      var transList = readTranslations(ss);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        translations: transList
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // (ج-4) إذا كان الطلب جلب أسئلة تمرين الوصل من ورقة "وصل" (4 أعمدة لكل تمرين)
    if (e && e.parameter && e.parameter.action === "get_matching") {
      var mSheet = getMatchingSheet(ss);
      var lastR = mSheet.getLastRow();
      var lastC = Math.max(5, mSheet.getLastColumn());
      var subjectsList = [];
      if (lastR > 1) {
        var rows = mSheet.getRange(2, 1, lastR - 1, lastC).getValues();
        for (var r = 0; r < rows.length; r++) {
          var row = rows[r];
          var subjName = String(row[0] || "").trim();
          if (subjName) {
            var exercises = [];
            var exNum = 1;
            for (var c = 1; c < row.length; c += 4) {
              var qText = String(row[c] || "").trim();
              var rWords = String(row[c + 1] || "").trim();
              var lWords = String(row[c + 2] || "").trim();
              var sStr = String(row[c + 3] || "").trim();
              if (qText || rWords || lWords || sStr) {
                var rArr = rWords ? rWords.split("|").map(function(s){return s.trim();}).filter(Boolean) : [];
                var lArr = lWords ? lWords.split("|").map(function(s){return s.trim();}).filter(Boolean) : [];
                var pairs = [];
                var maxLen = Math.max(rArr.length, lArr.length);
                for (var p = 0; p < maxLen; p++) {
                  pairs.push({
                    id: "p-" + p,
                    rightText: rArr[p] || "",
                    leftText: lArr[p] || ""
                  });
                }
                var inputMode = sStr.indexOf("صوت فقط") !== -1 ? "voice_only" : "both";
                var lockOnMistake = sStr.indexOf("لا تراجع") !== -1 || sStr.indexOf("قفل") !== -1;
                var showMistakeFeedback = sStr.indexOf("إخفاء") === -1;
                var allowSmartReassign = (sStr.indexOf("تصحيح ذكي") !== -1 && sStr.indexOf("بدون تصحيح ذكي") === -1) || sStr.indexOf("فك ذكي") !== -1 || sStr.indexOf("تبديل الإجابة") !== -1;
                var allowRetry = sStr.indexOf("منع الإعادة") === -1 && sStr.indexOf("لا إعادة") === -1 && sStr.indexOf("no_retry") === -1;
                var durMatch = sStr.match(/(\d+)\s*ثوان/);
                var durationSeconds = durMatch ? parseInt(durMatch[1]) : 4;
                exercises.push({
                  id: "ex-" + exNum,
                  exerciseNumber: exNum,
                  questionText: qText || ("صل الكلمات المناسبة " + exNum),
                  pairs: pairs,
                  inputMode: inputMode,
                  durationSeconds: durationSeconds,
                  lockOnMistake: lockOnMistake,
                  showMistakeFeedback: showMistakeFeedback,
                  allowSmartReassign: allowSmartReassign,
                  allowRetry: allowRetry
                });
                exNum++;
              }
            }
            subjectsList.push({
              id: "subj-" + (r + 1),
              subjectName: subjName,
              subject: subjName,
              exercises: exercises
            });
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        subjects: subjectsList
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // (ج-5) إذا كان الطلب جلب أسئلة التمرين الثالث من ورقة "كلمات" (4 أعمدة لكل تمرين)
    if (e && e.parameter && e.parameter.action === "get_dictation") {
      var wSheet = getWordsSheet(ss);
      var lastR = wSheet.getLastRow();
      var lastC = Math.max(5, wSheet.getLastColumn());
      var dictSubjects = [];
      if (lastR > 1) {
        var rows = wSheet.getRange(2, 1, lastR - 1, lastC).getValues();
        for (var r = 0; r < rows.length; r++) {
          var row = rows[r];
          var subjName = String(row[0] || "").trim();
          if (subjName) {
            var exercises = [];
            var exNum = 1;
            for (var c = 1; c < row.length; c += 4) {
              var qText = String(row[c] || "").trim();
              var poolStr = String(row[c + 1] || "").trim();
              var ansStr = String(row[c + 2] || "").trim();
              var setStr = String(row[c + 3] || "").trim();
              if (qText || poolStr || ansStr || setStr) {
                var allowRetry = setStr.indexOf("منع الإعادة") === -1 && setStr.indexOf("لا إعادة") === -1 && setStr.indexOf("no_retry") === -1;
                var durMatch = setStr.match(/(\\d+)\\s*ثوان/);
                var durationSeconds = durMatch ? parseInt(durMatch[1]) : 5;
                exercises.push({
                  id: "dict-ex-" + (r + 2) + "-" + exNum,
                  exerciseNumber: exNum,
                  questionText: qText || ("تمرين إملاء " + exNum),
                  scrambledPool: poolStr,
                  correctAnswer: ansStr,
                  settingsString: setStr,
                  durationSeconds: durationSeconds,
                  allowRetry: allowRetry
                });
                exNum++;
              }
            }
            dictSubjects.push({
              id: "dict-subj-" + (r + 1),
              subjectName: subjName,
              subject: subjName,
              exercises: exercises
            });
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        subjects: dictSubjects
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = getLessonsSheet(ss);
    
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return ContentService.createTextOutput(JSON.stringify({ success: true, count: 0, curriculum: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var lastCol = sheet.getLastColumn();
    var values = sheet.getRange(2, 1, lastRow - 1, Math.max(9, lastCol)).getValues();
    var curriculum = [];
    var currentLessonSubject = "الدرس الأول";
    
    for (var r = 0; r < values.length; r++) {
      var row = values[r];
      var rawSubject = String(row[0] || "").trim();
      if (rawSubject) {
        currentLessonSubject = rawSubject;
      }
      
      // مسح التمارين الأفقية: كل 8 أعمدة تمثل نصاً/تمريناً
      // B:I (col 1..8), J:Q (col 9..16), R:Y (col 17..24)...
      for (var col = 1; col < row.length; col += 8) {
        var wordText = String(row[col + 4] || "").trim(); // نص الدرس (مثل F أو N أو V)
        if (!wordText) continue; // تخطي الخانات الفارغة
        
        var category = String(row[col] || "").trim() || "الكلمة";
        var imageUrl = String(row[col + 1] || "").trim();
        var audioUrl = String(row[col + 2] || "").trim();
        var autoReadText = String(row[col + 3] || "").trim();
        var meaning = String(row[col + 5] || "").trim();
        var makhrajTip = String(row[col + 6] || "").trim();
        var repeatRaw = String(row[col + 7] || "").trim();
        var repeatCount = 1;
        var difficultyLevel = "medium";
        var recordingDuration = 5;
        var allowRetry = true;
        if (repeatRaw) {
          var repeatLower = repeatRaw.toLowerCase();
          if (repeatLower.indexOf("منع") !== -1 || repeatLower.indexOf("لا إعادة") !== -1 || repeatLower.indexOf("no_retry") !== -1 || repeatLower.indexOf("false") !== -1) {
            allowRetry = false;
          }
          var parts = repeatRaw.split(/[,|]/).map(function(s) { return s.trim(); });
          if (parts.length >= 1) {
            var p1 = parseInt(parts[0]);
            if (!isNaN(p1) && p1 >= 1) repeatCount = p1;
          }
          if (parts.length >= 2) {
            var p2 = parts[1].toLowerCase();
            if (p2 === "سهل" || p2 === "easy" || p2 === "مبتدئ") difficultyLevel = "easy";
            else if (p2 === "متقدم" || p2 === "hard" || p2 === "صارم") difficultyLevel = "hard";
            else difficultyLevel = "medium";
          }
          if (parts.length >= 3) {
            var p3 = parseInt(parts[2].replace(/[^0-9]/g, ''));
            if (!isNaN(p3) && p3 >= 2) recordingDuration = p3;
          }
        }
        
        curriculum.push({
          id: "sheet-r" + (r + 2) + "-c" + col,
          lessonSubject: currentLessonSubject,
          category: category,
          imageUrl: imageUrl || undefined,
          audioUrl: audioUrl || undefined,
          autoReadText: autoReadText || undefined,
          word: wordText,
          meaning: meaning || "",
          makhrajTip: makhrajTip || "",
          repeatCount: repeatCount,
          difficultyLevel: difficultyLevel,
          recordingDuration: recordingDuration,
          allowRetry: allowRetry
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      count: curriculum.length,
      sheetName: sheet.getName(),
      spreadsheetName: ss.getName(),
      spreadsheetUrl: ss.getUrl(),
      curriculum: curriculum,
      homeConfig: readHomeConfig(ss)
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 2. POST: استقبال الصوت وتخزينه في Drive وحفظ أو حذف التمارين في الصف المناسب
function doPost(e) {
  try {
    var raw = e.postData.contents;
    var data = JSON.parse(raw);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // (-1) تهيئة ورقة "الرئيسية"
    if (data.action === "init_home_sheet") {
      getHomeSheet(ss);
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "تم تهيئة ورقة الرئيسية بنجاح" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // (0) جلب أو التحقق من ورقة "ID registrants" للمشتركين
    if (data.action === "get_registrants" || data.action === "verify_student") {
      var regSheet = getIDRegistrantsSheet(ss);
      var lastR = regSheet.getLastRow();
      var registrants = [];
      if (lastR > 1) {
        var vals = regSheet.getRange(2, 1, lastR - 1, 2).getValues();
        for (var i = 0; i < vals.length; i++) {
          var rId = String(vals[i][0] || "").trim();
          var rName = String(vals[i][1] || "").trim();
          if (rId && rName && rId !== "ID") {
            registrants.push({ id: rId, name: rName });
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, registrants: registrants }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // (0-ب) إنشاء وتجهيز ورقة "ID registrants" أو إضافة مشترك
    if (data.action === "init_registrants_sheet" || data.action === "add_registrant") {
      var regSheet = getIDRegistrantsSheet(ss);
      if (data.id && data.name) {
        regSheet.appendRow([String(data.id).trim(), String(data.name).trim()]);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "تم إعداد ورقة ID registrants بنجاح" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // (0-ج) حفظ الترجمات في ورقة "الترجمة" وتحديث النصوص في ورقة "الرئيسية"
    if (data.action === "save_translations") {
      var tSheet = ss.getSheetByName("الترجمة") || ss.getSheetByName("Translations");
      if (!tSheet) {
        tSheet = ss.insertSheet("الترجمة");
        tSheet.getRange(1, 1, 1, 5).setValues([["المعرف (Key)", "القسم (Category)", "النص العربي (Arabic)", "الترجمة التايلاندية (Thai)", "الترجمة الإنجليزية (English)"]]);
        tSheet.getRange(1, 1, 1, 5).setBackground("#e0e7ff").setFontWeight("bold");
      }
      var tItems = data.items || [];
      if (tItems.length > 0) {
        if (tSheet.getLastRow() > 1) {
          tSheet.getRange(2, 1, tSheet.getLastRow() - 1, 5).clearContent();
        }
        var tRows = tItems.map(function(item) {
          return [item.id, item.category || "", item.ar || "", item.th || "", item.en || ""];
        });
        tSheet.getRange(2, 1, tRows.length, 5).setValues(tRows);

        // مزامنة النصوص مع ورقة "الرئيسية" وورقة "الدروس" (العامود 6 المعنى، والعامود 7 المخرج)
        var hSheet = ss.getSheetByName("الرئيسية");
        var lSheet = ss.getSheetByName("الدروس");
        for (var k = 0; k < tItems.length; k++) {
          var itm = tItems[k];
          if (hSheet) {
            if (itm.id === "nav_platform_title") hSheet.getRange(3, 2).setValue(itm.ar || "");
            if (itm.id === "nav_platform_subtitle") hSheet.getRange(4, 2).setValue(itm.ar || "");
            if (itm.id === "home_card_title") hSheet.getRange(23, 2).setValue(itm.ar || "");
            if (itm.id === "home_card_subtitle") hSheet.getRange(24, 2).setValue(itm.ar || "");
            if (itm.id === "home_card_extra1") hSheet.getRange(25, 2).setValue(itm.ar || "");
            if (itm.id === "home_card_extra2") hSheet.getRange(26, 2).setValue(itm.ar || "");
            if (itm.id === "home_card_extra3") hSheet.getRange(27, 2).setValue(itm.ar || "");
          }
          if (lSheet && itm.id && itm.id.indexOf("lesson_") === 0) {
            var isMeaning = itm.id.indexOf("_meaning") !== -1;
            var isMakhraj = itm.id.indexOf("_makhraj") !== -1;
            var targetWord = itm.id.replace("lesson_", "").replace("_meaning", "").replace("_makhraj", "");
            if (targetWord && (isMeaning || isMakhraj)) {
              var lData = lSheet.getDataRange().getValues();
              for (var lr = 1; lr < lData.length; lr++) {
                var lRow = lData[lr];
                for (var lc = 1; lc < lRow.length; lc += 8) {
                  var wVal = String(lRow[lc + 4] || "").trim();
                  if (wVal && (wVal === targetWord || wVal.replace(/[\u064B-\u065F\u0670]/g, '') === targetWord.replace(/[\u064B-\u065F\u0670]/g, ''))) {
                    if (isMeaning) lSheet.getRange(lr + 1, lc + 5 + 1).setValue(itm.ar || "");
                    if (isMakhraj) lSheet.getRange(lr + 1, lc + 6 + 1).setValue(itm.ar || "");
                  }
                }
              }
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "تم حفظ الترجمات بنجاح في ورقة الترجمة وتحديث ورقة الرئيسية" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // (0-د) تصدير ونقل كافة مواضيع وتمارين وصل الكلمات دفعة واحدة إلى ورقة "وصل" (4 أعمدة لكل تمرين)
    if (data.action === "export_matching_curriculum") {
      var mSheet = getMatchingSheet(ss);
      var subjectsArr = data.subjects || [];
      if (!Array.isArray(subjectsArr)) subjectsArr = [];

      var maxEx = 10;
      for (var s = 0; s < subjectsArr.length; s++) {
        if (subjectsArr[s].exercises && subjectsArr[s].exercises.length > maxEx) {
          maxEx = subjectsArr[s].exercises.length;
        }
      }

      // بناء صف العناوين: A = موضوع الدرس | ثم لكل تمرين 4 أعمدة (السؤال | اليمين | اليسار | الإعدادات)
      var headers = ["موضوع الدرس"];
      for (var ex = 1; ex <= maxEx; ex++) {
        headers.push("السؤال " + ex);
        headers.push("الكلمات في اليمين " + ex + " ( | )");
        headers.push("الكلمات في اليسار " + ex + " ( | )");
        headers.push("إعدادات التمرين " + ex);
      }

      // مسح المحتويات السابقة لإعادة كتابة الهيكل المعتمد بدقة
      mSheet.clearContents();
      mSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      mSheet.getRange(1, 1, 1, headers.length).setBackground("#6b21a8").setFontColor("#ffffff").setFontWeight("bold");

      var dataRows = [];
      var totalExCount = 0;
      for (var i = 0; i < subjectsArr.length; i++) {
        var subj = subjectsArr[i];
        var row = [String(subj.subjectName || "").trim()];
        var exercises = subj.exercises || [];
        for (var e = 0; e < maxEx; e++) {
          if (e < exercises.length) {
            var exItem = exercises[e];
            row.push(String(exItem.questionText || "").trim());
            row.push(String(exItem.rightWords || "").trim());
            row.push(String(exItem.leftWords || "").trim());
            row.push(String(exItem.settingsString || "").trim());
            totalExCount++;
          } else {
            row.push("", "", "", "");
          }
        }
        dataRows.push(row);
      }

      if (dataRows.length > 0) {
        mSheet.getRange(2, 1, dataRows.length, headers.length).setValues(dataRows);
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "تم تصدير " + subjectsArr.length + " مواضيع و " + totalExCount + " تمارين بنجاح إلى ورقة (وصل)",
        count: totalExCount
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // (0-د-2) حفظ أو تحديث تمرين وصل الكلمات في ورقة "وصل" (4 أعمدة لكل تمرين)
    if (data.action === "save_matching_exercise") {
      var mSheet = getMatchingSheet(ss);
      var subjName = String(data.subjectName || data.subject || "").trim();
      var exIdx = parseInt(data.exerciseNumber || data.exerciseIndex || 1);
      var qText = String(data.questionText || "").trim();
      var rWords = String(data.rightWords || "").trim();
      var lWords = String(data.leftWords || "").trim();
      var sStr = String(data.settingsString || data.settings || "").trim();
      
      var lastR = mSheet.getLastRow();
      var targetRow = -1;
      if (lastR > 1) {
        var sVals = mSheet.getRange(2, 1, lastR - 1, 1).getValues();
        for (var i = 0; i < sVals.length; i++) {
          if (String(sVals[i][0] || "").trim() === subjName) {
            targetRow = i + 2;
            break;
          }
        }
      }
      if (targetRow === -1) {
        targetRow = lastR + 1;
        mSheet.getRange(targetRow, 1).setValue(subjName);
      }
      
      var startCol = 2 + (exIdx - 1) * 4;
      mSheet.getRange(targetRow, startCol, 1, 4).setValues([[qText, rWords, lWords, sStr]]);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "تم حفظ تمرين الوصل في ورقة (وصل) بنجاح"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // (0-هـ) تسجيل نتائج إجابة تمرين الوصل في ورقة "answers 2"
    if (data.action === "submit_matching_answer") {
      var a2Sheet = getAnswers2Sheet(ss);
      var timestamp = data.timestamp || new Date().toLocaleString("ar-SA");
      var sId = String(data.studentId || "").trim();
      var sName = String(data.studentName || "").trim();
      var subj = String(data.lessonSubject || data.subjectName || data.subject || "").trim();
      var exIdx = parseInt(data.exerciseIndex || data.exerciseNumber || 1);
      var formula = String(data.resultFormula || data.summaryString || "").trim();
      var compStatus = String(data.completionStatus || "").trim();

      var lastR = a2Sheet.getLastRow();
      var foundRow = -1;
      if (lastR > 1) {
        var rows = a2Sheet.getRange(2, 2, lastR - 1, 3).getValues();
        for (var r = 0; r < rows.length; r++) {
          var rId = String(rows[r][0] || "").trim();
          var rName = String(rows[r][1] || "").trim();
          var rSubj = String(rows[r][2] || "").trim();
          if ((sId && rId === sId && rSubj === subj) || (rName === sName && rSubj === subj)) {
            foundRow = r + 2;
            break;
          }
        }
      }

      var exCol = 6 + (exIdx - 1);
      if (foundRow > 0) {
        a2Sheet.getRange(foundRow, 1).setValue(timestamp);
        if (sId) a2Sheet.getRange(foundRow, 2).setValue(sId);
        if (sName) a2Sheet.getRange(foundRow, 3).setValue(sName);
        if (subj) a2Sheet.getRange(foundRow, 4).setValue(subj);
        if (compStatus) a2Sheet.getRange(foundRow, 5).setValue(compStatus);
        a2Sheet.getRange(foundRow, exCol).setValue(formula);
      } else {
        var newRow = [timestamp, sId, sName, subj, compStatus];
        while (newRow.length < 5 + exIdx) {
          newRow.push("");
        }
        newRow[5 + (exIdx - 1)] = formula;
        a2Sheet.appendRow(newRow);
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "تم تسجيل إجابة تمرين الوصل في ورقة (answers 2) بنجاح"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // (0-و) تصدير كافة مواضيع وتمارين الإملاء دفعة واحدة إلى ورقة "كلمات" (4 أعمدة لكل تمرين)
    if (data.action === "export_dictation_curriculum") {
      var wSheet = getWordsSheet(ss);
      var subjectsArr = data.subjects || [];
      if (!Array.isArray(subjectsArr)) subjectsArr = [];

      var maxEx = 10;
      for (var s = 0; s < subjectsArr.length; s++) {
        if (subjectsArr[s].exercises && subjectsArr[s].exercises.length > maxEx) {
          maxEx = subjectsArr[s].exercises.length;
        }
      }

      var headers = ["موضوع الدرس"];
      for (var ex = 1; ex <= maxEx; ex++) {
        headers.push("السؤال " + ex);
        headers.push("الحروف والكلمات المشتتة " + ex);
        headers.push("الإجابة الصحيحة " + ex);
        headers.push("الإعدادات " + ex);
      }

      wSheet.clearContents();
      wSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      wSheet.getRange(1, 1, 1, headers.length).setBackground("#0f766e").setFontColor("#ffffff").setFontWeight("bold");

      var dataRows = [];
      var totalExCount = 0;
      for (var i = 0; i < subjectsArr.length; i++) {
        var subj = subjectsArr[i];
        var row = [String(subj.subjectName || "").trim()];
        var exercises = subj.exercises || [];
        for (var e = 0; e < maxEx; e++) {
          if (e < exercises.length) {
            var exItem = exercises[e];
            row.push(String(exItem.questionText || "").trim());
            row.push(String(exItem.scrambledPool || "").trim());
            row.push(String(exItem.correctAnswer || "").trim());
            row.push(String(exItem.settingsString || "").trim());
            totalExCount++;
          } else {
            row.push("", "", "", "");
          }
        }
        dataRows.push(row);
      }

      if (dataRows.length > 0) {
        wSheet.getRange(2, 1, dataRows.length, headers.length).setValues(dataRows);
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "تم تصدير " + subjectsArr.length + " مواضيع و " + totalExCount + " تمارين بنجاح إلى ورقة (كلمات)",
        count: totalExCount
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // (0-و-2) حفظ أو تحديث تمرين إملاء واحد في ورقة "كلمات" (4 أعمدة لكل تمرين)
    if (data.action === "save_dictation_exercise") {
      var wSheet = getWordsSheet(ss);
      var subjName = String(data.subjectName || data.subject || "").trim();
      var exIdx = parseInt(data.exerciseNumber || data.exerciseIndex || 1);
      var qText = String(data.questionText || "").trim();
      var poolStr = String(data.scrambledPool || "").trim();
      var ansStr = String(data.correctAnswer || "").trim();
      var setStr = String(data.settingsString || data.settings || "").trim();

      var lastR = wSheet.getLastRow();
      var targetRow = -1;
      if (lastR > 1) {
        var sVals = wSheet.getRange(2, 1, lastR - 1, 1).getValues();
        for (var i = 0; i < sVals.length; i++) {
          if (String(sVals[i][0] || "").trim() === subjName) {
            targetRow = i + 2;
            break;
          }
        }
      }
      if (targetRow === -1) {
        targetRow = lastR + 1;
        wSheet.getRange(targetRow, 1).setValue(subjName);
      }

      var startCol = 2 + (exIdx - 1) * 4;
      wSheet.getRange(targetRow, startCol, 1, 4).setValues([[qText, poolStr, ansStr, setStr]]);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "تم حفظ التمرين في ورقة (كلمات) بنجاح"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // (0-ز) تسجيل نتائج إجابة تمرين الإملاء في ورقة "answers 3"
    if (data.action === "submit_dictation_answer") {
      var a3Sheet = getAnswers3Sheet(ss);
      var timestamp = data.timestamp || new Date().toLocaleString("ar-SA");
      var sId = String(data.studentId || "").trim();
      var sName = String(data.studentName || "").trim();
      var subj = String(data.lessonSubject || data.subjectName || data.subject || "").trim();
      var exIdx = parseInt(data.exerciseIndex || data.exerciseNumber || 1);
      var formula = String(data.resultFormula || data.summaryString || "").trim();
      var compStatus = String(data.completionStatus || "").trim();

      var lastR = a3Sheet.getLastRow();
      var foundRow = -1;
      if (lastR > 1) {
        var rows = a3Sheet.getRange(2, 2, lastR - 1, 3).getValues();
        for (var r = 0; r < rows.length; r++) {
          var rId = String(rows[r][0] || "").trim();
          var rName = String(rows[r][1] || "").trim();
          var rSubj = String(rows[r][2] || "").trim();
          if ((sId && rId === sId && rSubj === subj) || (rName === sName && rSubj === subj)) {
            foundRow = r + 2;
            break;
          }
        }
      }

      var exCol = 6 + (exIdx - 1);
      if (foundRow > 0) {
        a3Sheet.getRange(foundRow, 1).setValue(timestamp);
        if (sId) a3Sheet.getRange(foundRow, 2).setValue(sId);
        if (sName) a3Sheet.getRange(foundRow, 3).setValue(sName);
        if (subj) a3Sheet.getRange(foundRow, 4).setValue(subj);
        if (compStatus) a3Sheet.getRange(foundRow, 5).setValue(compStatus);
        a3Sheet.getRange(foundRow, exCol).setValue(formula);
      } else {
        var newRow = [timestamp, sId, sName, subj, compStatus];
        while (newRow.length < 5 + exIdx) {
          newRow.push("");
        }
        newRow[5 + (exIdx - 1)] = formula;
        a3Sheet.appendRow(newRow);
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "تم تسجيل إجابة تمرين الإملاء في ورقة (answers 3) بنجاح"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // (أ) حفظ صوت المعلم في مجلد الإدارة والشرح (1YuCKWxGjQn9E2EAKqoKN-7-Kl_UeDC4t)
    if (data.action === "upload_audio" && data.audioBase64) {
      var teacherFolder = getOrCreateAudioFolder(data.driveFolderId || "1YuCKWxGjQn9E2EAKqoKN-7-Kl_UeDC4t");
      var cleanBase64 = String(data.audioBase64);
      if (cleanBase64.indexOf("base64,") !== -1) {
        cleanBase64 = cleanBase64.split("base64,")[1];
      }
      var dateForFile = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT+3", "yyyy-MM-dd_HH-mm");
      var baseName = String(data.customFileName || data.word || data.fileName || "teacher_audio").trim().replace(/[/\\?%*:|"<>]/g, '_');
      var finalTeacherFileName = baseName + "_" + dateForFile + ".mp3";
      var blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), "audio/mp3", finalTeacherFileName);
      var driveFile;
      try {
        driveFile = teacherFolder.createFile(blob);
      } catch (cfErr) {
        driveFile = DriveApp.getRootFolder().createFile(blob);
      }
      try {
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (sErr) {}
      var fileId = driveFile.getId();
      var directAudioUrl = "https://drive.google.com/uc?export=download&id=" + fileId;
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        fileId: fileId,
        audioUrl: directAudioUrl,
        message: "تم حفظ ورفع صوت المعلم في Google Drive بنجاح!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // (أ-2) تسجيل إجابة الطالب الأفقية في ورقة "answers 1" ورفع ملف صوت الطالب إلى مجلد الطلاب (1o80NgUVp64TwTt_yRn3I83c6gy8Ce1iA)
    if (data.action === "submit_student_answer") {
      var ansSheet = getAnswers1Sheet(ss);
      var studentId = String(data.studentId || "").trim();
      var studentName = String(data.studentName || "طالب").trim();
      var lessonSubject = String(data.lessonSubject || "الدرس الأول").trim();
      var targetWord = String(data.targetWord || "").trim();
      var detectedWord = String(data.detectedWord || "").trim();
      var scoreVal = data.score !== undefined ? data.score : 0;
      var grade = String(data.feedback || data.grade || "").trim();
      
      // 1. رفع صوت الطالب إلى مجلد صوتيات الطلاب المخصص في Google Drive
      var directAudioUrl = "";
      if (data.audioBase64) {
        try {
          var targetFolderId = String(data.studentDriveFolderId || data.driveFolderId || "").trim();
          if (!targetFolderId || targetFolderId === "1YuCKWxGjQn9E2EAKqoKN-7-Kl_UeDC4t") {
            targetFolderId = "1o80NgUVp64TwTt_yRn3I83c6gy8Ce1iA";
          }
          var studentFolder = getOrCreateAudioFolder(targetFolderId);
          var cleanBase64 = String(data.audioBase64);
          if (cleanBase64.indexOf("base64,") !== -1) {
            cleanBase64 = cleanBase64.split("base64,")[1];
          }
          var cleanName = studentName.replace(/[/\\?%*:|"<>]/g, '_');
          var cleanId = studentId.replace(/[/\\?%*:|"<>]/g, '_');
          var cleanWord = (targetWord || detectedWord || "تمرين").replace(/[/\\?%*:|"<>]/g, '_');
          var dateForFile = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT+3", "yyyy-MM-dd_HH-mm");
          var fullFileName = (cleanId ? (cleanId + "_") : "") + cleanName + "_" + cleanWord + "_" + dateForFile + ".mp3";

          var blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), "audio/mp3", fullFileName);
          var driveFile;
          try {
            driveFile = studentFolder.createFile(blob);
          } catch (cfErr) {
            driveFile = DriveApp.getRootFolder().createFile(blob);
          }
          try {
            driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          } catch (sErr) {}
          directAudioUrl = "https://drive.google.com/uc?export=download&id=" + driveFile.getId();
        } catch (uploadErr) {
          Logger.log("Drive student audio upload error: " + uploadErr);
        }
      }
      
      // 2. تنسيق الوقت والتاريخ الحالي
      var timeFormatted = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT+3", "yyyy/MM/dd HH:mm:ss");
      
      // 3. البحث عن صف هذا المشترك لنفس موضوع الدرس
      var lastRow = ansSheet.getLastRow();
      var targetRow = -1;
      var existingRowValues = [];
      
      if (lastRow > 1) {
        var lastCol = Math.max(5, ansSheet.getLastColumn());
        var allRows = ansSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
        for (var r = 0; r < allRows.length; r++) {
          var rId = String(allRows[r][1] || "").trim();
          var rName = String(allRows[r][2] || "").trim();
          var rSubject = String(allRows[r][3] || "").trim();
          
          var idMatches = studentId && rId === studentId;
          var nameMatches = (!studentId || !rId) && (rName === studentName);
          
          if ((idMatches || nameMatches) && rSubject === lessonSubject) {
            targetRow = r + 2;
            existingRowValues = allRows[r];
            break;
          }
        }
      }
      
      // 4. تحديد الحزمة الأفقية المكونة من 5 أعمدة لهذا التمرين
      // الأعمدة تبدأ من Col F (index 6 في الشيت، index 5 في مصفوفة الجافاسكربت)
      // كل تمرين 5 أعمدة: الكلمة المستهدفة | النص المنطوق | رابط ملف الصوت | الدرجة % | التقدير
      var targetBlockCol = -1;
      
      if (targetRow !== -1 && existingRowValues.length > 5) {
        // أ) هل نفس الكلمة موجودة مسبقاً في أحد البلوكات؟ (لتحديثها بالدرجة والتسجيل الجديد)
        for (var c = 5; c < existingRowValues.length; c += 5) {
          var wordInCell = String(existingRowValues[c] || "").trim();
          if (wordInCell && (wordInCell === targetWord || wordInCell.replace(/[\u064B-\u0652]/g, '') === targetWord.replace(/[\u064B-\u0652]/g, ''))) {
            targetBlockCol = c + 1; // 1-based column
            break;
          }
        }
      }
      
      // ب) إذا لم نجد الكلمة مسبقاً، نستخدم wordIndex إذا توفر
      if (targetBlockCol === -1) {
        var wIdx = (data.wordIndex !== undefined && parseInt(data.wordIndex) >= 0) ? parseInt(data.wordIndex) : -1;
        if (wIdx >= 0) {
          targetBlockCol = 6 + (wIdx * 5); // 1-based (Col 6 is F, 11 is K, 16 is P...)
        }
      }
      
      // ج) كخيار احتياطي: أول حزمة فارغة
      if (targetBlockCol === -1) {
        if (targetRow !== -1 && existingRowValues.length > 5) {
          for (var c = 5; c < existingRowValues.length; c += 5) {
            if (!String(existingRowValues[c] || "").trim()) {
              targetBlockCol = c + 1;
              break;
            }
          }
          if (targetBlockCol === -1) {
            targetBlockCol = existingRowValues.length + 1;
          }
        } else {
          targetBlockCol = 6; // أول تمرين F:J
        }
      }
      
      var blockData = [[
        targetWord,
        detectedWord,
        directAudioUrl,
        scoreVal + "%",
        grade
      ]];
      
      // التأكد من توفر أعمدة كافية في الورقة
      var requiredColMax = targetBlockCol + 4;
      if (ansSheet.getMaxColumns() < requiredColMax) {
        ansSheet.insertColumnsAfter(ansSheet.getMaxColumns(), requiredColMax - ansSheet.getMaxColumns());
      }

      // (تسجيل تلقائي وتأكيد كافة عناوين الأعمدة في ورقة answers 1)
      try {
        ensureAnswersHeaders(ansSheet, requiredColMax);
      } catch (headErr) {
        Logger.log("Headers generation note: " + headErr);
      }
      
      if (targetRow !== -1) {
        // تحديث الصف الحالي
        ansSheet.getRange(targetRow, 1).setValue(timeFormatted);
        if (studentId) ansSheet.getRange(targetRow, 2).setValue(studentId);
        if (studentName) ansSheet.getRange(targetRow, 3).setValue(studentName);
        ansSheet.getRange(targetRow, 4).setValue(lessonSubject);
        ansSheet.getRange(targetRow, targetBlockCol, 1, 5).setValues(blockData);
      } else {
        // إنشاء صف جديد لهذا المشترك في هذا الدرس
        var newRow = [
          timeFormatted,
          studentId,
          studentName,
          lessonSubject,
          "" // العامود E المحجوز
        ];
        // ملء الخانات الفارغة إن وجدت قبل هذه الحزمة
        var padCount = targetBlockCol - 6;
        for (var p = 0; p < padCount; p++) {
          newRow.push("");
        }
        newRow = newRow.concat(blockData[0]);
        if (ansSheet.getMaxColumns() < newRow.length) {
          ansSheet.insertColumnsAfter(ansSheet.getMaxColumns(), newRow.length - ansSheet.getMaxColumns());
        }
        ansSheet.appendRow(newRow);
        targetRow = ansSheet.getLastRow();
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        rowIndex: targetRow,
        blockCol: targetBlockCol,
        audioUrl: directAudioUrl,
        message: "تم حفظ وتوثيق إجابتك في ورقة answers 1 بنجاح!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // (ب) حفظ أو تعديل تمرين في الصف الأفقي لموضوع الدرس
    if (data.action === "save_word" && data.wordItem) {
      var sheet = getLessonsSheet(ss);
      var item = data.wordItem;
      var audioUrl = item.audioUrl || "";
      
      // رفع الصوت المسجل أو المرفوع إلى مجلد Google Drive المحدد إن وجد base64
      if (data.audioBase64) {
        try {
          var folder = getOrCreateAudioFolder(data.driveFolderId);
          var cleanBase64 = String(data.audioBase64);
          if (cleanBase64.indexOf("base64,") !== -1) {
            cleanBase64 = cleanBase64.split("base64,")[1];
          }
          var dateForFile = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT+3", "yyyy-MM-dd_HH-mm");
          var baseName = String(data.customFileName || item.word || "teacher_audio").trim().replace(/[/\\?%*:|"<>]/g, '_');
          var finalTeacherFileName = baseName + "_" + dateForFile + ".mp3";
          var blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), "audio/mp3", finalTeacherFileName);
          var driveFile;
          try {
            driveFile = folder.createFile(blob);
          } catch (cfErr) {
            driveFile = DriveApp.getRootFolder().createFile(blob);
          }
          try {
            driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          } catch (sErr) {}
          audioUrl = "https://drive.google.com/uc?export=download&id=" + driveFile.getId();
        } catch (uploadErr) {
          Logger.log("Drive upload error: " + uploadErr);
        }
      }
      
      var lastRow = sheet.getLastRow();
      var lessonRowIndex = -1;
      var wordColIndex = -1;
      var targetSubject = String(item.lessonSubject || "الدرس الأول").trim();
      
      if (lastRow > 1) {
        var lastCol = Math.max(9, sheet.getLastColumn());
        var allValues = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
        
        for (var r = 0; r < allValues.length; r++) {
          var rSubject = String(allValues[r][0] || "").trim();
          if (rSubject === targetSubject) {
            lessonRowIndex = r + 2;
            
            // 1. هل الكلمة موجودة بالفعل في إحدى حزم الـ 8 أعمدة لتحديثها؟
            for (var c = 1; c < allValues[r].length; c += 8) {
              if (String(allValues[r][c + 4] || "").trim() === String(item.word || "").trim()) {
                wordColIndex = c + 1; // رقم العامود في الشيت (1-based)
                break;
              }
            }
            
            // 2. إذا لم تكن موجودة، يتم إلحاقها دائماً في نهاية الصف بعد آخر تمرين موجود
            if (wordColIndex === -1) {
              var lastOccupiedCol = 1;
              for (var c = 1; c < allValues[r].length; c += 8) {
                if (String(allValues[r][c + 4] || "").trim()) {
                  lastOccupiedCol = c + 8; // بعد نهاية هذا التمرين
                }
              }
              wordColIndex = lastOccupiedCol + 1;
            }
            break;
          }
        }
      }
      
      var blockData = [[
        item.category || "الكلمة",
        item.imageUrl || "",
        audioUrl,
        item.autoReadText || "",
        item.word,
        item.meaning || "",
        item.makhrajTip || "",
        (function() {
          var rep = parseInt(item.repeatCount) || 1;
          var diff = item.difficultyLevel || "medium";
          var diffArabic = diff === "easy" ? "سهل" : (diff === "hard" ? "متقدم" : "متوسط");
          var dur = parseInt(item.recordingDuration) || 5;
          var retryArabic = item.allowRetry === false ? "منع الإعادة" : "السماح بالإعادة";
          return rep + "," + diffArabic + "," + dur + "," + retryArabic;
        })()
      ]];
      
      if (lessonRowIndex !== -1 && wordColIndex !== -1) {
        var neededCols = wordColIndex + 7;
        if (sheet.getMaxColumns() < neededCols) {
          sheet.insertColumnsAfter(sheet.getMaxColumns(), neededCols - sheet.getMaxColumns());
        }
        sheet.getRange(lessonRowIndex, wordColIndex, 1, 8).setValues(blockData);
      } else {
        // إنشاء صف جديد للدرس يبدأ بـ العامود A ومعه أول تمرين (B:I)
        var newRow = [targetSubject].concat(blockData[0]);
        if (sheet.getMaxColumns() < newRow.length) {
          sheet.insertColumnsAfter(sheet.getMaxColumns(), newRow.length - sheet.getMaxColumns());
        }
        sheet.appendRow(newRow);
      }

      // التحقق وتوليد عناوين الأعمدة التلقائية لورقة الدروس
      try {
        ensureLessonsHeaders(sheet, Math.max(sheet.getLastColumn(), 9));
      } catch (lhErr) {
        Logger.log("Lessons headers note: " + lhErr);
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        audioUrl: audioUrl
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // (ج) حذف تمرين معين من الحزمة المخصصة له
    if (data.action === "delete_word" && data.word) {
      var sheet = getLessonsSheet(ss);
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        var lastCol = Math.max(9, sheet.getLastColumn());
        var allValues = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
        for (var r = 0; r < allValues.length; r++) {
          if (!data.lessonSubject || String(allValues[r][0] || "").trim() === String(data.lessonSubject).trim()) {
            for (var c = 1; c < allValues[r].length; c += 8) {
              if (String(allValues[r][c + 4] || "").trim() === String(data.word).trim()) {
                sheet.getRange(r + 2, c + 1, 1, 8).clearContent();
                break;
              }
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // (د) تصدير وتحديث المنهج كاملاً من النظام إلى ورقة "الدروس" بالهيكل الأفقي
    if (data.action === "sync_full_curriculum" && Array.isArray(data.curriculum)) {
      var sheet = getLessonsSheet(ss);
      
      var maxItemsPerLesson = 1;
      var grouped = {};
      var subjectsOrder = [];
      
      for (var i = 0; i < data.curriculum.length; i++) {
        var itm = data.curriculum[i];
        var s = String(itm.lessonSubject || "الدرس الأول").trim();
        if (!grouped[s]) {
          grouped[s] = [];
          subjectsOrder.push(s);
        }
        grouped[s].push(itm);
        if (grouped[s].length > maxItemsPerLesson) {
          maxItemsPerLesson = grouped[s].length;
        }
      }
      
      // التأكد من توفر جميع الأعمدة وتوسيع الورقة تلقائياً
      var totalColsNeeded = 1 + (Math.max(maxItemsPerLesson, 4) * 8);
      var curMaxCols = sheet.getMaxColumns();
      if (curMaxCols < totalColsNeeded) {
        sheet.insertColumnsAfter(curMaxCols, totalColsNeeded - curMaxCols);
      }
      
      // التأكد من توفر صفوف كافية
      var totalRowsNeeded = Math.max(subjectsOrder.length + 5, 20);
      var curMaxRows = sheet.getMaxRows();
      if (curMaxRows < totalRowsNeeded) {
        sheet.insertRowsAfter(curMaxRows, totalRowsNeeded - curMaxRows);
      }
      
      // تفريغ المحتويات القديمة من الصف 2 فما دون
      var lastR = sheet.getLastRow();
      if (lastR > 1) {
        sheet.getRange(2, 1, lastR - 1, sheet.getMaxColumns()).clearContent();
      }
      
      // عناوين الأعمدة في الصف 1
      var headerRow = ["موضوع الدرس"];
      for (var k = 1; k <= Math.max(maxItemsPerLesson, 4); k++) {
        headerRow.push(
          "الفئة " + k,
          "رابط الصورة " + k,
          "رابط الصوت " + k,
          "نص للقراءة الآلية " + k,
          "نص الدرس " + k,
          "المعنى والتوضيح " + k,
          "إرشادات المخرج " + k,
          "عدد التكرار " + k
        );
      }
      
      sheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
      sheet.getRange(1, 1, 1, headerRow.length).setFontWeight("bold").setBackground("#e6f4ea");
      
      // تجهيز مصفوفة الصفوف وكتابتها دفعة واحدة لسرعة وأمان تامين
      if (subjectsOrder.length > 0) {
        var allRows = [];
        for (var sIdx = 0; sIdx < subjectsOrder.length; sIdx++) {
          var subjectName = subjectsOrder[sIdx];
          var items = grouped[subjectName] || [];
          var rowData = [subjectName];
          
          for (var itemIdx = 0; itemIdx < items.length; itemIdx++) {
            var curItem = items[itemIdx];
            rowData.push(
              curItem.category || "الكلمة",
              curItem.imageUrl || "",
              curItem.audioUrl || "",
              curItem.autoReadText || "",
              curItem.word || "",
              curItem.meaning || "",
              curItem.makhrajTip || "",
              (function() {
                var rep = parseInt(curItem.repeatCount) || 1;
                var diff = curItem.difficultyLevel || "medium";
                var diffArabic = diff === "easy" ? "سهل" : (diff === "hard" ? "متقدم" : "متوسط");
                var dur = parseInt(curItem.recordingDuration) || 5;
                var retryArabic = curItem.allowRetry === false ? "منع الإعادة" : "السماح بالإعادة";
                return rep + "," + diffArabic + "," + dur + "," + retryArabic;
              })()
            );
          }
          
          while (rowData.length < headerRow.length) {
            rowData.push("");
          }
          allRows.push(rowData);
        }
        
        sheet.getRange(2, 1, allRows.length, headerRow.length).setValues(allRows);
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        count: data.curriculum.length,
        lessonsCount: subjectsOrder.length,
        sheetName: sheet.getName(),
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        message: "تم بنجاح رفع " + data.curriculum.length + " تمريناً إلى ورقة [" + sheet.getName() + "] في ملف (" + ss.getName() + ")!"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // (هـ) تسجيل درجات وتقييم الطلاب في ورقة "سجل_النتائج"
    var resultSheet = ss.getSheetByName("سجل_النتائج") || ss.getSheetByName("النتائج");
    if (!resultSheet) {
      resultSheet = ss.insertSheet("سجل_النتائج");
      resultSheet.appendRow([
        "التاريخ والوقت",
        "اسم الطالب",
        "الكلمة أو الحرف",
        "الدرجة %",
        "التقدير",
        "ما سُمع من الطالب",
        "نظام التقييم",
        "ملاحظات التقييم"
      ]);
      resultSheet.getRange(1, 1, 1, 8).setBackground("#047857").setFontColor("#ffffff").setFontWeight("bold");
    }
    
    resultSheet.appendRow([
      data.timestamp || new Date().toLocaleString(),
      data.studentName || "طالب",
      data.word || "",
      data.score || 0,
      data.grade || "",
      data.detectedWord || "",
      data.engineUsed || "داخلي",
      data.feedback || ""
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    var errStr = err.toString();
    var friendlyError = errStr;
    if (errStr.indexOf("DriveApp") !== -1 || errStr.indexOf("permission") !== -1 || errStr.indexOf("drive.readonly") !== -1) {
      friendlyError = "خطأ في أذونات Google Drive: " + errStr + " (تأكد من تشغيل دالة authorizePermissions ثم عمل Deploy -> Manage Deployments -> تعديل واختيار New Version).";
    }
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: friendlyError
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;
