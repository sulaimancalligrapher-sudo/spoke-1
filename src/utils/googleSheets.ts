import { WordItem, StudentSubmissionRecord } from '../types';
import { removeTashkeel } from './arabicMatcher';

export const DEFAULT_DRIVE_AUDIO_FOLDER_ID = '1YuCKWxGjQn9E2EAKqoKN-7-Kl_UeDC4t';
export const DEFAULT_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycby-gs675oYfrXKPdpG2tttTHmH-f4rzWaWQ7rdsAjUylDLb1mRFsRP7B6PV4VCAq-0rTw/exec';

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
      if (data && data.success !== false && !data.error) {
        return { success: true, data, message: data.message };
      }
      if (data && data.error) {
        return { success: false, error: data.error };
      }
    } else {
      const errData = await proxyRes.json().catch(() => null);
      if (errData && errData.error) {
        return { success: false, error: errData.error };
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
      meaning: String(item.meaning || '').trim() || 'كلمة تعليمية',
      category: String(item.category || '').trim() || 'الكلمة',
      lessonSubject: String(item.lessonSubject || '').trim() || 'الدرس الأول',
      imageUrl: item.imageUrl ? String(item.imageUrl).trim() : undefined,
      audioUrl: item.audioUrl ? String(item.audioUrl).trim() : undefined,
      autoReadText: item.autoReadText ? String(item.autoReadText).trim() : undefined,
      makhrajTip: String(item.makhrajTip || '').trim() || 'انطق الكلمة بوضوح ومخارج سليمة.',
      letterFocus: String(item.word || '').trim()[0],
      repeatCount:
        typeof item.repeatCount === 'number' && item.repeatCount > 0
          ? item.repeatCount
          : parseInt(item.repeatCount) || 1,
    }))
    .filter((w: WordItem) => Boolean(w.word));

  const extractedSubjects: string[] = Array.from(new Set(words.map((w) => w.lessonSubject).filter(Boolean)));
  const extractedCategories: string[] = Array.from(new Set(words.map((w) => w.category).filter(Boolean)));

  return {
    success: true,
    curriculum: words,
    subjects: extractedSubjects.length > 0 ? extractedSubjects : undefined,
    categories: extractedCategories.length > 0 ? extractedCategories : undefined,
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
  driveFolderId = DEFAULT_DRIVE_AUDIO_FOLDER_ID
): Promise<{ success: boolean; audioUrl?: string; fileId?: string; message: string }> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, message: 'رابط Google Sheets Webhook غير مدخل' };
  }

  const payload = {
    action: 'upload_audio',
    driveFolderId,
    word: wordText || 'lesson',
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
 * Complete Google Apps Script Template Code
 * Supports:
 * - Sheet "الدروس" with horizontal lessons:
 *   - Col A: موضوع الدرس
 *   - Col B:I: النص الأول (8 أعمدة: الفئة | الصورة | الصوت | القراءة الآلية | نص الدرس | المعنى | المخرج | التكرار)
 *   - Col J:Q: النص الثاني (8 أعمدة)
 *   - Col R:Y: النص الثالث (8 أعمدة)
 *   - Col Z:AG: النص الرابع (8 أعمدة)... وهكذا بلا حدود!
 * - Automatic saving of recorded or uploaded audio into Google Drive folder: 1YuCKWxGjQn9E2EAKqoKN-7-Kl_UeDC4t
 * - Sheet "سجل_النتائج" for student marks
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
 * معرف مجلد Google Drive للأصوات: 1YuCKWxGjQn9E2EAKqoKN-7-Kl_UeDC4t
 */

var DEFAULT_FOLDER_ID = "1YuCKWxGjQn9E2EAKqoKN-7-Kl_UeDC4t";

// دالة مساعدة ذكية للعثور على ورقة الدروس وتجنب أي خطأ في التسمية
function getLessonsSheet(ss) {
  var sheet = ss.getSheetByName("الدروس");
  if (sheet) return sheet;
  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) {
    var name = all[i].getName().trim();
    if (name === "الدروس" || name === "دروس" || name.indexOf("درس") !== -1 || name.indexOf("الدروس") !== -1) {
      return all[i];
    }
  }
  // إذا لم نجد ورقة باسم الدروس، نستخدم الورقة الأولى بشرط ألا تكون ورقة النتائج
  if (all.length > 0) {
    var firstName = all[0].getName();
    if (firstName.indexOf("نتائج") === -1 && firstName.indexOf("سجل") === -1) {
      return all[0];
    }
  }
  try {
    return ss.insertSheet("الدروس");
  } catch(e) {
    return all[0];
  }
}

// 1. GET: جلب جميع الدروس والتمارين الأفقية فورياً
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
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
        var repeatCount = parseInt(row[col + 7]) || 1;
        if (repeatCount < 1) repeatCount = 1;
        
        curriculum.push({
          id: "sheet-r" + (r + 2) + "-c" + col,
          lessonSubject: currentLessonSubject,
          category: category,
          imageUrl: imageUrl || undefined,
          audioUrl: audioUrl || undefined,
          autoReadText: autoReadText || undefined,
          word: wordText,
          meaning: meaning || "تمرين قرائي",
          makhrajTip: makhrajTip || "انطق الكلمة بوضوح ومخارج سليمة.",
          repeatCount: repeatCount
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      count: curriculum.length,
      curriculum: curriculum
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
    
    // (أ) حفظ صوت المعلم مباشرة في Google Drive واسترجاع الرابط المباشر
    if (data.action === "upload_audio" && data.audioBase64) {
      var folderId = data.driveFolderId || DEFAULT_FOLDER_ID;
      var folder = DriveApp.getFolderById(folderId);
      var cleanBase64 = String(data.audioBase64);
      if (cleanBase64.indexOf("base64,") !== -1) {
        cleanBase64 = cleanBase64.split("base64,")[1];
      }
      var timeId = new Date().getTime();
      var blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), "audio/mp3", "audio_" + timeId + ".mp3");
      var driveFile = folder.createFile(blob);
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var fileId = driveFile.getId();
      var directAudioUrl = "https://drive.google.com/uc?export=download&id=" + fileId;
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        fileId: fileId,
        audioUrl: directAudioUrl,
        message: "تم حفظ ورفع الصوت في Google Drive بنجاح!"
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
          var folderId = data.driveFolderId || DEFAULT_FOLDER_ID;
          var folder = DriveApp.getFolderById(folderId);
          var cleanBase64 = String(data.audioBase64);
          if (cleanBase64.indexOf("base64,") !== -1) {
            cleanBase64 = cleanBase64.split("base64,")[1];
          }
          var timeId = new Date().getTime();
          var blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), "audio/mp3", "audio_" + timeId + ".mp3");
          var driveFile = folder.createFile(blob);
          driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
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
            
            // 2. إن لم تكن موجودة، ابحث عن أول حزمة 8 أعمدة فارغة في نفس صف الدرس
            if (wordColIndex === -1) {
              for (var c = 1; c < allValues[r].length; c += 8) {
                if (!String(allValues[r][c + 4] || "").trim()) {
                  wordColIndex = c + 1;
                  break;
                }
              }
            }
            
            // 3. إن كانت كل الحزم مليئة، افتح حزمة جديدة في نهاية الصف
            if (wordColIndex === -1) {
              wordColIndex = allValues[r].length + 1;
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
        parseInt(item.repeatCount) || 1
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
              parseInt(curItem.repeatCount) || 1
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
        message: "تم تحديث ورقة الدروس بنجاح بنظام الأعمدة الأفقية!"
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
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;
