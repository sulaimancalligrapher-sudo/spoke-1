export type SupportedLang = 'ar' | 'th' | 'en';

export interface TranslationItem {
  id: string; // unique key e.g. 'home_title'
  category: 'home' | 'lessons' | 'practice'; // 1- نافذة التسجيل والرئيسية | 2- صفحة الدروس | 3- تسجيل الصوت والنتائج
  categoryLabel: string;
  ar: string; // النص العربي الأصلي
  th: string; // الترجمة التايلاندية
  en: string; // الترجمة الإنجليزية
  isSheetLinked?: boolean; // هل النص مرتبط أصلاً بورقة شيت أخرى مثل "الرئيسية"
  sheetSourceNote?: string; // ملاحظة للمستخدم لتعديل الأصل العربي من الورقة المخصصة
}

export const LANGUAGE_OPTIONS: { code: SupportedLang; name: string; nativeName: string; flag: string }[] = [
  { code: 'ar', name: 'العربية', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'th', name: 'التايلاندية', nativeName: 'ภาษาไทย', flag: '🇹🇭' },
  { code: 'en', name: 'الإنجليزية', nativeName: 'English', flag: '🇬🇧' },
];

export const DEFAULT_TRANSLATIONS: TranslationItem[] = [
  // ==========================================
  // الموضع الأول: نافذة التسجيل والصفحة الرئيسية (home)
  // ==========================================
  {
    id: 'nav_platform_title',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'فَصِيح',
    th: 'ฟะซีฮ์ (Faseeh)',
    en: 'Faseeh',
    isSheetLinked: true,
    sheetSourceNote: 'مرتبط بعنوان المنصة في ورقة الرئيسية (B3)',
  },
  {
    id: 'nav_smart_eval_badge',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'تقييم النطق الذكي',
    th: 'ประเมินการออกเสียงอัจฉริยะ',
    en: 'Smart Pronunciation Evaluation',
  },
  {
    id: 'nav_platform_subtitle',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'تعليم النطق والاستماع وتقييم مخارج الحروف العربية',
    th: 'เรียนรู้การออกเสียง การฟัง และประเมินฐานเกิดเสียงภาษาอาหรับ',
    en: 'Learn Arabic pronunciation, listening, and phoneme articulation',
    isSheetLinked: true,
    sheetSourceNote: 'مرتبط بوصف المنصة في ورقة الرئيسية (B4)',
  },
  {
    id: 'nav_open_lessons',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'فتح الدروس 📚',
    th: 'เปิดบทเรียน 📚',
    en: 'Open Lessons 📚',
  },
  {
    id: 'nav_student_login',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'دخول المشترك',
    th: 'เข้าสู่ระบบผู้เรียน',
    en: 'Student Login',
  },
  {
    id: 'nav_eval_history',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'سجل التقييمات والإنجاز',
    th: 'บันทึกการประเมินและความสำเร็จ',
    en: 'Evaluation & Achievement Log',
  },
  {
    id: 'nav_logout',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'تسجيل الخروج',
    th: 'ออกจากระบบ',
    en: 'Logout',
  },
  {
    id: 'home_badge',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'منصة التقييم والنطق العربي الفصيح',
    th: 'แพลตฟอร์มการประเมินและการออกเสียงภาษาอาหรับมาตรฐาน',
    en: 'Arabic Pronunciation & Evaluation Platform',
  },
  {
    id: 'home_card_title',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'أتقن نطق العربية ومخارج الحروف بدقة الذكاء الاصطناعي',
    th: 'ฝึกฝนการออกเสียงภาษาอาหรับและฐานเกิดเสียงด้วยความแม่นยำของ AI',
    en: 'Master Arabic Pronunciation and Articulation with AI Precision',
    isSheetLinked: true,
    sheetSourceNote: 'مرتبط ببطاقة ورقة الرئيسية (B23)',
  },
  {
    id: 'home_card_subtitle',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'تدرّب على نطق الحروف والكلمات والحركات واستمع للصوت النموذجي، مع تقييم صوتي فوري وتوثيق مباشر لدرجاتك في Google Sheets',
    th: 'ฝึกฝนการออกเสียงพยัญชนะ สระ และคำศัพท์ พร้อมฟังเสียงต้นแบบ รับการประเมินทันที และบันทึกคะแนนลง Google Sheets',
    en: 'Practice Arabic letters, words, and vowels, listen to model audio, get instant feedback, and record scores directly to Google Sheets',
    isSheetLinked: true,
    sheetSourceNote: 'مرتبط بوصف بطاقة ورقة الرئيسية (B24)',
  },
  {
    id: 'home_start_btn',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'ابدأ التدريب الآن مجاناً 🚀',
    th: 'เริ่มฝึกฝนตอนนี้ฟรี 🚀',
    en: 'Start Practice Now Free 🚀',
  },
  {
    id: 'home_guide_btn',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'دليل ومواصفات المنصة',
    th: 'คู่มือและข้อมูลจำเพาะ',
    en: 'Platform Guide',
  },
  {
    id: 'login_modal_title',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'تسجيل دخول المشترك',
    th: 'เข้าสู่ระบบผู้เรียน',
    en: 'Student Registration / Login',
  },
  {
    id: 'login_modal_desc',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'سجّل اسمك ورقمك لتوثيق إنجازاتك في ورقة الدرجات (answers 1)',
    th: 'กรอกชื่อและรหัสของคุณเพื่อบันทึกผลการเรียนลงในชีต answers 1',
    en: 'Enter your name and ID to record your achievements in answers 1',
  },
  {
    id: 'login_name_label',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'اسم المشترك:',
    th: 'ชื่อผู้เรียน:',
    en: 'Student Name:',
  },
  {
    id: 'login_id_label',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'رقم المشترك (ID) أو رقم الجوال:',
    th: 'รหัสผู้เรียน (ID) หรือเบอร์โทรศัพท์:',
    en: 'Student ID or Mobile Number:',
  },
  {
    id: 'login_submit_btn',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'تسجيل ومتابعة التدريب',
    th: 'ลงทะเบียนและเริ่มฝึกฝน',
    en: 'Register & Continue Practice',
  },
  {
    id: 'stats_modal_title',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'سجل إنجازات وتقييمات المشترك',
    th: 'บันทึกความสำเร็จและการประเมินของผู้เรียน',
    en: 'Student Achievements & Evaluation Log',
  },

  // ==========================================
  // الموضع الثاني: صفحة الدروس (lessons)
  // ==========================================
  {
    id: 'lessons_modal_title',
    category: 'lessons',
    categoryLabel: 'صفحة الدروس',
    ar: 'فهرس الدروس والكلمات',
    th: 'ดัชนีบทเรียนและคำศัพท์',
    en: 'Lessons & Vocabulary Index',
  },
  {
    id: 'lessons_modal_desc',
    category: 'lessons',
    categoryLabel: 'صفحة الدروس',
    ar: 'اختر الدرس أو الموضوع للتدرب على كلماته ونطقه',
    th: 'เลือกบทเรียนหรือหัวข้อเพื่อฝึกออกเสียงคำศัพท์',
    en: 'Select a lesson or subject to practice pronunciation',
  },
  {
    id: 'lessons_filter_all',
    category: 'lessons',
    categoryLabel: 'صفحة الدروس',
    ar: 'الكل',
    th: 'ทั้งหมด',
    en: 'All',
  },
  {
    id: 'lessons_search_placeholder',
    category: 'lessons',
    categoryLabel: 'صفحة الدروس',
    ar: 'بحث عن كلمة أو حرف...',
    th: 'ค้นหาคำหรือพยัญชนะ...',
    en: 'Search for a word or letter...',
  },
  {
    id: 'lessons_prev_btn',
    category: 'lessons',
    categoryLabel: 'صفحة الدروس',
    ar: 'السابق',
    th: 'ก่อนหน้า',
    en: 'Previous',
  },
  {
    id: 'lessons_next_btn',
    category: 'lessons',
    categoryLabel: 'صفحة الدروس',
    ar: 'التالي',
    th: 'ถัดไป',
    en: 'Next',
  },
  {
    id: 'lessons_word_count',
    category: 'lessons',
    categoryLabel: 'صفحة الدروس',
    ar: 'كلمات',
    th: 'คำ',
    en: 'words',
  },
  {
    id: 'category_letter',
    category: 'lessons',
    categoryLabel: 'صفحة الدروس',
    ar: 'الحرف',
    th: 'พยัญชนะ',
    en: 'Letter',
  },
  {
    id: 'category_word',
    category: 'lessons',
    categoryLabel: 'صفحة الدروس',
    ar: 'الكلمة',
    th: 'คำศัพท์',
    en: 'Word',
  },
  {
    id: 'category_sentence',
    category: 'lessons',
    categoryLabel: 'صفحة الدروس',
    ar: 'الجملة',
    th: 'ประโยค',
    en: 'Sentence',
  },

  // ==========================================
  // الموضع الثالث: صفحة تسجيل الصوت والنتائج (practice)
  // ==========================================
  {
    id: 'practice_listen_btn',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'استمع للصوت',
    th: 'ฟังเสียงต้นแบบ',
    en: 'Listen to Audio',
  },
  {
    id: 'practice_slow_listen_btn',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'بطيء',
    th: 'ช้า',
    en: 'Slow (0.7x)',
  },
  {
    id: 'practice_teacher_audio',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'صوت المعلم',
    th: 'เสียงครูผู้สอน',
    en: "Teacher's Voice",
  },
  {
    id: 'practice_record_btn',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'اضغط وتحدث الآن',
    th: 'กดแล้วพูดเลย',
    en: 'Tap & Speak Now',
  },
  {
    id: 'practice_recording_active',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'جاري التسجيل... انطق الكلمة بوضوح',
    th: 'กำลังบันทึกเสียง... กรุณาออกเสียงให้ชัดเจน',
    en: 'Recording... Speak clearly',
  },
  {
    id: 'practice_evaluating',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'جاري تحليل النطق والتقييم...',
    th: 'กำลังวิเคราะห์และประเมินการออกเสียง...',
    en: 'Analyzing & Evaluating pronunciation...',
  },
  {
    id: 'practice_submitted_and_locked',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'تم التسجيل و التقييم',
    th: 'บันทึกและประเมินผลเรียบร้อยแล้ว',
    en: 'Recorded & Evaluated',
  },
  {
    id: 'practice_score_label',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'درجة النطق',
    th: 'คะแนนการออกเสียง',
    en: 'Pronunciation Score',
  },
  {
    id: 'grade_excellent',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'ممتاز',
    th: 'ยอดเยี่ยม',
    en: 'Excellent',
  },
  {
    id: 'grade_very_good',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'جيد جداً',
    th: 'ดีมาก',
    en: 'Very Good',
  },
  {
    id: 'grade_good',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'جيد',
    th: 'ดี',
    en: 'Good',
  },
  {
    id: 'grade_needs_practice',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'يحتاج تدريب',
    th: 'ต้องฝึกฝنเพิ่มเติม',
    en: 'Needs Practice',
  },
  {
    id: 'practice_makhraj_tip_title',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'مخرج الحرف وكيفية نطقه:',
    th: 'ฐานเกิดเสียงและวิธีการออกเสียง:',
    en: 'Articulation Point & Guidance:',
  },
  {
    id: 'practice_meaning_title',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'المعنى والتوضيح:',
    th: 'ความหมายและคำอธิบาย:',
    en: 'Meaning & Explanation:',
  },
  {
    id: 'practice_detected_text',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'ما نطق به المشترك:',
    th: 'เสียงที่ระบบตรวจพบ:',
    en: 'Detected Speech:',
  },
  {
    id: 'practice_re_record_btn',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'إعادة التسجيل',
    th: 'บันทึกเสียงใหม่',
    en: 'Re-record',
  },
  {
    id: 'practice_send_sheets',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'توثيق النتيجة في Google Sheets',
    th: 'บันทึกคะแนนลง Google Sheets',
    en: 'Save score to Google Sheets',
  },
];

const STORAGE_KEY_LANG = 'faseeh_active_lang';
const STORAGE_KEY_TRANSLATIONS = 'faseeh_custom_translations_v1';

export function getStoredLanguage(): SupportedLang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LANG) as SupportedLang;
    if (saved === 'ar' || saved === 'th' || saved === 'en') {
      return saved;
    }
  } catch {}
  return 'ar';
}

export function setStoredLanguage(lang: SupportedLang): void {
  try {
    localStorage.setItem(STORAGE_KEY_LANG, lang);
  } catch {}
}

export function getStoredTranslations(): TranslationItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRANSLATIONS);
    if (raw) {
      const parsed: TranslationItem[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge with defaults to ensure any new keys exist
        const map = new Map<string, TranslationItem>();
        DEFAULT_TRANSLATIONS.forEach((d) => map.set(d.id, d));
        parsed.forEach((p) => {
          const existing = map.get(p.id);
          if (existing) {
            map.set(p.id, { ...existing, th: p.th || existing.th, en: p.en || existing.en });
          } else {
            map.set(p.id, p);
          }
        });
        return Array.from(map.values());
      }
    }
  } catch {}
  return DEFAULT_TRANSLATIONS;
}

export function saveStoredTranslations(items: TranslationItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_TRANSLATIONS, JSON.stringify(items));
  } catch {}
}

/**
 * Translate a UI key into the active language
 */
export function getTranslatedString(
  key: string,
  lang: SupportedLang,
  items: TranslationItem[] = DEFAULT_TRANSLATIONS,
  fallbackAr?: string
): string {
  if (lang === 'ar') {
    return fallbackAr || items.find((i) => i.id === key)?.ar || key;
  }
  const item = items.find((i) => i.id === key);
  if (!item) return fallbackAr || key;
  if (lang === 'th') return item.th || item.ar || fallbackAr || key;
  if (lang === 'en') return item.en || item.ar || fallbackAr || key;
  return item.ar || fallbackAr || key;
}

/**
 * Call Gemini translation API for a single text
 */
export async function translateSingleWithAI(
  text: string,
  apiKey?: string
): Promise<{ th: string; en: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-gemini-key'] = apiKey;

  const res = await fetch('/api/translate', {
    method: 'POST',
    headers,
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error('Failed to translate with AI');
  }
  const data = await res.json();
  return { th: data.th || '', en: data.en || '' };
}

/**
 * Call Gemini translation API for multiple items at once
 */
export async function translateBatchWithAI(
  items: { id: string; text: string }[],
  apiKey?: string
): Promise<Record<string, { th: string; en: string }>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-gemini-key'] = apiKey;

  const res = await fetch('/api/translate', {
    method: 'POST',
    headers,
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    throw new Error('Failed to batch translate with AI');
  }
  const data = await res.json();
  const result: Record<string, { th: string; en: string }> = {};
  if (Array.isArray(data.translations)) {
    data.translations.forEach((t: any) => {
      if (t.id) {
        result[t.id] = { th: t.th || '', en: t.en || '' };
      }
    });
  }
  return result;
}
