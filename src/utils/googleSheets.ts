import { StudentSubmissionRecord } from '../types';

/**
 * Send a student evaluation record to Google Sheets via Webhook (Google Apps Script)
 */
export async function sendScoreToGoogleSheets(
  webhookUrl: string,
  record: StudentSubmissionRecord
): Promise<{ success: boolean; message: string }> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return { success: false, message: 'رابط Google Sheets غير صالح' };
  }

  const payload = {
    timestamp: new Date(record.timestamp).toLocaleString('ar-SA'),
    studentName: record.studentName || 'طالب مجهول',
    word: record.word,
    score: record.score,
    grade: record.grade,
    detectedWord: record.detectedWord || '',
    engineUsed: record.engineUsed === 'ai' ? 'ذكاء اصطناعي (Gemini)' : 'النظام الداخلي (مستمر)',
    feedback: record.feedback || '',
  };

  try {
    // Send via POST. Google Apps Script redirects with 302, so mode: 'no-cors' ensures successful delivery
    await fetch(webhookUrl.trim(), {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
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

  // UTF-8 BOM for Arabic characters in Excel
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
 * Apps Script Template Code to show the teacher
 */
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `// كود Google Apps Script البسيط لربط فصيح بجدول Google Sheets
// خطوات التركيب (تأخذ دقيقة واحدة):
// 1. افتح جدول Google Sheets جديد
// 2. من القائمة العلوية: اختر (الإضافات Extensions -> Apps Script)
// 3. الصق هذا الكود بالكامل، ثم اضغط على زر النشر (Deploy -> New deployment)
// 4. اختر النوع: Web app، وضع صلاحية الدخول: Anyone (أي شخص)
// 5. انسخ الرابط الناتج وضعه في خانة رابط الويب هوك داخل لوحة إدارة فصيح

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // إذا كان الجدول فارغاً، أنشئ العناوين تلقائياً في الصف الأول
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "التاريخ والوقت",
        "اسم الطالب",
        "الكلمة أو الحرف",
        "الدرجة %",
        "التقدير",
        "ما سُمع من الطالب",
        "نظام التقييم",
        "ملاحظات التقييم"
      ]);
      // تنسيق شريط العناوين بلون أنيق
      sheet.getRange(1, 1, 1, 8).setBackground("#10b981").setFontColor("#ffffff").setFontWeight("bold");
    }
    
    var data = JSON.parse(e.postData.contents);
    sheet.appendRow([
      data.timestamp || new Date().toLocaleString(),
      data.studentName || "طالب",
      data.word || "",
      data.score || 0,
      data.grade || "",
      data.detectedWord || "",
      data.engineUsed || "داخلي",
      data.feedback || ""
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;
