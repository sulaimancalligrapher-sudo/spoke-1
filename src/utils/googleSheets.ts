import { WordItem, StudentSubmissionRecord } from '../types';
import { removeTashkeel } from './arabicMatcher';

export const DEFAULT_DRIVE_AUDIO_FOLDER_ID = '1YuCKWxGjQn9E2EAKqoKN-7-Kl_UeDC4t';

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

  try {
    const cleanUrl = webhookUrl.trim();
    const targetUrl = cleanUrl.includes('?') 
      ? `${cleanUrl}&action=get_curriculum&_t=${Date.now()}` 
      : `${cleanUrl}?action=get_curriculum&_t=${Date.now()}`;

    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return { success: false, error: `استجاب السيرفر برمز خطأ: ${res.status}` };
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.curriculum)) {
      return {
        success: false,
        error: 'لم يتم العثور على تمارين في ورقة "الدروس". تأكد من تسمية الورقة (الدروس) وترتيب الأعمدة A ثم B:I و J:Q و R:Y...',
      };
    }

    const words: WordItem[] = data.curriculum.map((item: any, idx: number) => ({
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
      repeatCount: typeof item.repeatCount === 'number' && item.repeatCount > 0 
        ? item.repeatCount 
        : (parseInt(item.repeatCount) || 1),
    })).filter((w: WordItem) => Boolean(w.word));

    const extractedSubjects: string[] = Array.from(new Set(words.map((w) => w.lessonSubject).filter(Boolean)));
    const extractedCategories: string[] = Array.from(new Set(words.map((w) => w.category).filter(Boolean)));

    return {
      success: true,
      curriculum: words,
      subjects: extractedSubjects.length > 0 ? extractedSubjects : undefined,
      categories: extractedCategories.length > 0 ? extractedCategories : undefined,
    };
  } catch (err: any) {
    console.warn('Error fetching curriculum from Google Sheets:', err);
    return {
      success: false,
      error: 'تعذر جلب الدروس من Google Sheets: ' + (err?.message || 'تأكد من نشر السكربت بوضعية Anyone'),
    };
  }
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

  try {
    const res = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      return {
        success: true,
        audioUrl: data?.audioUrl,
        message: 'تم حفظ التمرين في ورقة "الدروس" بنجاح!',
      };
    }

    return {
      success: true,
      message: 'تم إرسال طلب الحفظ إلى Google Sheets!',
    };
  } catch (err: any) {
    console.warn('Error saving word to sheets:', err);
    return {
      success: false,
      message: 'تعذر حفظ التمرين في الشيت: ' + (err?.message || 'خطأ في الشبكة'),
    };
  }
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

  try {
    await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'delete_word',
        word: wordText,
        lessonSubject,
      }),
    });

    return { success: true, message: 'تم حذف التمرين من ورقة "الدروس" بنجاح' };
  } catch (err: any) {
    return { success: false, message: 'خطأ أثناء الحذف: ' + err.message };
  }
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

  try {
    const res = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      return {
        success: true,
        count: data?.count || curriculum.length,
        lessonsCount: data?.lessonsCount,
        message: data?.message || `تم بنجاح رفع وتحديث ${curriculum.length} كلمة وتدريب في ورقة "الدروس" في Google Sheets بالهيكل الأفقي المعتمد!`,
      };
    }

    return {
      success: true,
      count: curriculum.length,
      message: `تم إرسال طلب تصدير المنهج بالكامل (${curriculum.length} تمرين) إلى Google Sheets!`,
    };
  } catch (err: any) {
    console.warn('Error syncing curriculum to sheets:', err);
    return {
      success: false,
      message: 'تعذر رفع المنهج إلى Google Sheets: ' + (err?.message || 'خطأ في الشبكة'),
    };
  }
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

  try {
    await fetch(webhookUrl.trim(), {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    return {
      success: true,
      message: 'تم إرسال الدرجة بنجاح إلى جدول Google Sheets!',
    };
  } catch (err: any) {
    console.warn('Google Sheets sync error:', err);
    return {
      success: false,
      message: 'تعذر الاتصال بـ Google Sheets: ' + (err?.message || 'خطأ في الشبكة'),
    };
  }
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

// 1. GET: جلب جميع الدروس والتمارين الأفقية فورياً
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("الدروس") || ss.getSheetByName("دروس") || ss.getSheets()[0];
    
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
    
    // (أ) حفظ أو تعديل تمرين في الصف الأفقي لموضوع الدرس
    if (data.action === "save_word" && data.wordItem) {
      var sheet = ss.getSheetByName("الدروس") || ss.getSheetByName("دروس") || ss.getSheets()[0];
      var item = data.wordItem;
      var audioUrl = item.audioUrl || "";
      
      // رفع الصوت المسجل أو المرفوع إلى مجلد Google Drive المحدد
      if (data.audioBase64) {
        try {
          var folderId = data.driveFolderId || DEFAULT_FOLDER_ID;
          var folder = DriveApp.getFolderById(folderId);
          var cleanBase64 = data.audioBase64.replace(/^data:audio\\/[a-z0-9_-]+;base64,/, "");
          var blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), "audio/mp3", "audio_" + (item.word || "word") + "_" + Date.now() + ".mp3");
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
        sheet.getRange(lessonRowIndex, wordColIndex, 1, 8).setValues(blockData);
      } else {
        // إنشاء صف جديد للدرس يبدأ بـ العامود A ومعه أول تمرين (B:I)
        var newRow = [targetSubject].concat(blockData[0]);
        sheet.appendRow(newRow);
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        audioUrl: audioUrl
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // (ب) حذف تمرين معين من الحزمة المخصصة له
    if (data.action === "delete_word" && data.word) {
      var sheet = ss.getSheetByName("الدروس") || ss.getSheetByName("دروس") || ss.getSheets()[0];
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
    
    // (ج) تصدير وتحديث المنهج كاملاً من النظام إلى ورقة "الدروس" بالهيكل الأفقي
    if (data.action === "sync_full_curriculum" && Array.isArray(data.curriculum)) {
      var sheet = ss.getSheetByName("الدروس") || ss.getSheetByName("دروس");
      if (!sheet) {
        sheet = ss.insertSheet("الدروس");
      }
      
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
      
      // تفريغ المحتويات القديمة من الصف 2 فما دون
      var lastR = sheet.getLastRow();
      var lastC = Math.max(9, sheet.getLastColumn());
      if (lastR > 1) {
        sheet.getRange(2, 1, lastR - 1, lastC).clearContent();
      }
      
      // التأكد من عناوين الأعمدة في الصف 1
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
      
      // كتابة صفوف الدروس
      if (subjectsOrder.length > 0) {
        for (var sIdx = 0; sIdx < subjectsOrder.length; sIdx++) {
          var subjectName = subjectsOrder[sIdx];
          var items = grouped[subjectName];
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
          sheet.getRange(sIdx + 2, 1, 1, rowData.length).setValues([rowData]);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        count: data.curriculum.length,
        lessonsCount: subjectsOrder.length,
        message: "تم تحديث ورقة الدروس بنجاح بنظام الأعمدة الأفقية!"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // (د) تسجيل درجات وتقييم الطلاب في ورقة "سجل_النتائج"
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
