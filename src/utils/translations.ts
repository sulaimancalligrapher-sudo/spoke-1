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
    ar: '',
    th: '',
    en: '',
  },
  {
    id: 'home_card_title',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: '',
    th: '',
    en: '',
    isSheetLinked: true,
    sheetSourceNote: 'مرتبط ببطاقة ورقة الرئيسية (B23)',
  },
  {
    id: 'home_card_subtitle',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: '',
    th: '',
    en: '',
    isSheetLinked: true,
    sheetSourceNote: 'مرتبط بوصف بطاقة ورقة الرئيسية (B24)',
  },
  {
    id: 'home_card_extra1',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: '',
    th: '',
    en: '',
    isSheetLinked: true,
    sheetSourceNote: 'مرتبط بالنص الإضافي 1 في ورقة الرئيسية (B25)',
  },
  {
    id: 'home_card_extra2',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: '',
    th: '',
    en: '',
    isSheetLinked: true,
    sheetSourceNote: 'مرتبط بالنص الإضافي 2 في ورقة الرئيسية (B26)',
  },
  {
    id: 'home_card_extra3',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: '',
    th: '',
    en: '',
    isSheetLinked: true,
    sheetSourceNote: 'مرتبط بالنص الإضافي 3 في ورقة الرئيسية (B27)',
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
  {
    id: 'eval_score_badge',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'الدرجة',
    th: 'คะแนน',
    en: 'Score',
  },
  {
    id: 'eval_theme_excellent',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'ممتاز جداً! نطق فصيح ومتقن',
    th: 'ยอดเยี่ยมมาก! การออกเสียงถูกต้องและแม่นยำ',
    en: 'Excellent! Accurate and fluent articulation',
  },
  {
    id: 'eval_theme_very_good',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'نطق جيد جداً!',
    th: 'การออกเสียงดีมาก!',
    en: 'Very Good Pronunciation!',
  },
  {
    id: 'eval_theme_acceptable',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'نطق مقبول مع ملاحظات',
    th: 'การออกเสียงพอใช้ มีข้อควรปรับปรุง',
    en: 'Acceptable pronunciation with notes',
  },
  {
    id: 'eval_theme_needs_practice',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'يحتاج إلى مزيد من التمرين',
    th: 'ต้องฝึกฝนเพิ่มเติม',
    en: 'Needs more practice',
  },
  {
    id: 'eval_target_word_label',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'الكلمة المستهدفة:',
    th: 'คำเป้าหมาย:',
    en: 'Target Word:',
  },
  {
    id: 'eval_detected_speech_label',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'ما سُمع من النطق:',
    th: 'เสียงที่ระบบตรวจพบ:',
    en: 'Detected Speech:',
  },
  {
    id: 'eval_match_success',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: '✓ نطق مطابق ومقبول',
    th: '✓ ออกเสียงถูกต้องสอดคล้อง',
    en: '✓ Matched and accepted',
  },
  {
    id: 'eval_match_warning',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: '⚠ يحتاج تدقيق في بعض الحروف',
    th: '⚠ ควรระวังบางพยัญชนะ',
    en: '⚠ Check specific letters',
  },
  {
    id: 'eval_listen_teacher',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'استماع لنطق المعلم',
    th: 'ฟังเสียงครูต้นแบบ',
    en: 'Listen to Teacher',
  },
  {
    id: 'eval_listen_student',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'استماع لصوت الطالب المسجل',
    th: 'ฟังเสียงที่บันทึกไว้',
    en: 'Listen to Student',
  },
  {
    id: 'eval_stop_audio',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'إيقاف صوتي',
    th: 'หยุดเสียง',
    en: 'Stop Audio',
  },
  {
    id: 'eval_tab_acoustic',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'مقارنة صوتية',
    th: 'เปรียบเทียบเสียง',
    en: 'Acoustic Match',
  },
  {
    id: 'eval_tab_letters',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'تحليل الحروف',
    th: 'วิเคราะห์พยัญชนะ',
    en: 'Letter Breakdown',
  },
  {
    id: 'eval_tab_visual',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'المقارنة المرئية',
    th: 'เปรียบเทียบคลื่นเสียง',
    en: 'Visual Spectrum',
  },
  {
    id: 'eval_mfcc_comparison',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'مقارنة البصمة الصوتية مع تسجيل المعلم:',
    th: 'เปรียบเทียบลายพิมพ์เสียงกับครูผู้สอน:',
    en: 'Voice fingerprint comparison with teacher:',
  },
  {
    id: 'eval_char_match',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'تطابق الحروف',
    th: 'ความตรงของตัวอักษร',
    en: 'Letter match',
  },
  {
    id: 'eval_fingerprint_match',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'تطابق البصمة',
    th: 'ความตรงของลายพิมพ์เสียง',
    en: 'Fingerprint match',
  },
  {
    id: 'eval_pronunciation_duration',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'زمن النطق',
    th: 'ระยะเวลาออกเสียง',
    en: 'Duration',
  },
  {
    id: 'eval_no_teacher_audio_note',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'لم يُسجل صوت المعلم النموذجي لهذا التمرين بعد. تم التقييم عبر التحليل الفيزيائي المباشر للترددات ومخارج الحروف.',
    th: 'ยังไม่มีเสียงบันทึกของครูต้นแบบสำหรับแบบฝึกหัดนี้ ระบบประเมินด้วยการวิเคราะห์คลื่นความถี่โดยตรง',
    en: 'No teacher model audio registered yet. Evaluated via direct acoustic and phoneme analysis.',
  },
  {
    id: 'eval_voice_power',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'قوة ونقاء الصوت',
    th: 'ความชัดเจนของเสียง',
    en: 'Voice clarity & energy',
  },
  {
    id: 'eval_actual_duration',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'زمن النطق الفعلي',
    th: 'ระยะเวลาออกเสียงจริง',
    en: 'Actual speech duration',
  },
  {
    id: 'eval_elongation_match',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'تطابق المدود',
    th: 'ความตรงของสระเสียงยาว',
    en: 'Vowel elongation match',
  },
  {
    id: 'eval_articulation_clarity',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'وضوح المخرج',
    th: 'ความชัดเจนของฐานเกิดเสียง',
    en: 'Articulation clarity',
  },
  {
    id: 'eval_all_letters_sound',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'جميع مخارج الحروف الأساسية مكتملة ومطابقة.',
    th: 'ฐานเกิดเสียงพยัญชนะทั้งหมดครบถ้วนและถูกต้อง',
    en: 'All primary letter phonemes are accurate and complete.',
  },
  {
    id: 'eval_articulation_guide',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'إرشاد المخرج الصوتي:',
    th: 'คำแนะนำฐานเกิดเสียง:',
    en: 'Articulation guidance:',
  },
  {
    id: 'eval_vowel_accuracy',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'دقة الحركات والمدود:',
    th: 'ความถูกต้องของสระและเสียงยาว:',
    en: 'Vowels & diacritics accuracy:',
  },
  {
    id: 'eval_letter_sound',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: '✓ سليم',
    th: '✓ ถูกต้อง',
    en: '✓ Sound',
  },
  {
    id: 'eval_letter_needs_work',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: '⚠ يحتاج ضبط',
    th: '⚠ ต้องปรับปรุง',
    en: '⚠ Needs work',
  },
  {
    id: 'eval_submitting_audio',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'جارٍ رفع الصوت وتوثيق الدرجة... ⏳',
    th: 'กำลังอัปโหลดเสียงและบันทึกคะแนน... ⏳',
    en: 'Uploading audio and saving score... ⏳',
  },
  {
    id: 'eval_submit_success',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'تم إرسال إجابتك واعتمادها بنجاح! ✅',
    th: 'ส่งคำตอบและรับรองผลเรียบร้อยแล้ว! ✅',
    en: 'Your answer was submitted and approved! ✅',
  },
  {
    id: 'eval_repetitions_label',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'التكرار:',
    th: 'การทำซ้ำ:',
    en: 'Repetitions:',
  },
  {
    id: 'eval_difficulty_easy',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'سهل 🟢',
    th: 'ง่าย 🟢',
    en: 'Easy 🟢',
  },
  {
    id: 'eval_difficulty_medium',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'متوسط 🟡',
    th: 'ปานกลาง 🟡',
    en: 'Medium 🟡',
  },
  {
    id: 'eval_difficulty_hard',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'متقدم 🔴',
    th: 'ขั้นสูง 🔴',
    en: 'Advanced 🔴',
  },
  {
    id: 'practice_makhraj_how_to',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: '💡 كيف تنطق هذا الحرف؟',
    th: '💡 วิธีออกเสียงพยัญชนะนี้?',
    en: '💡 How to pronounce this letter?',
  },
  {
    id: 'practice_harakat_label',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'الحركات:',
    th: 'สระ:',
    en: 'Vowels:',
  },
  {
    id: 'practice_analyzing_modal_title',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'جاري تحليل نطقك وتدقيق الحركات...',
    th: 'กำลังวิเคราะห์การออกเสียงและตรวจสระ...',
    en: 'Analyzing your pronunciation & vowels...',
  },
  {
    id: 'practice_analyzing_modal_desc',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'يقوم محرك الذكاء بفحص مخارج الحركات ومطابقة الكلمة، استعد لرؤية النتيجة!',
    th: 'ระบบกำลังตรวจฐานเสียงและเปรียบเทียบคำศัพท์ โปรดรอผลการประเมิน!',
    en: 'Checking phonemes and matching word, get ready for results!',
  },
  {
    id: 'practice_analyzing_modal_sub',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'لحظات قليلة وتظهر النتيجة...',
    th: 'รอสักครู่ ผลลัพธ์กำลังจะแสดง...',
    en: 'A few moments and results will appear...',
  },

  // ==========================================
  // الموضع الرابع: المقارنة المرئية وسجل الإنجازات والتقييمات المتغيرة
  // ==========================================
  {
    id: 'eval_theme_excellent_full',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'نطق ممتاز ومتقن!',
    th: 'การออกเสียงยอดเยี่ยมและแม่นยำ!',
    en: 'Excellent and accurate pronunciation!',
  },
  {
    id: 'eval_theme_wonderful',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'ممتاز ورائع!',
    th: 'ยอดเยี่ยมและน่าประทับใจ!',
    en: 'Excellent and wonderful!',
  },
  {
    id: 'eval_spectrum_banner_title',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'مقارنة البصرية والسمعية',
    th: 'เปรียบเทียบคลื่นเสียงและการได้ยิน',
    en: 'Visual & Audio Spectrum Comparison',
  },
  {
    id: 'eval_spectrum_auto_update',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'تحديث تلقائي',
    th: 'อัปเดตอัตโนมัติ',
    en: 'Auto-updating',
  },
  {
    id: 'eval_spectrum_inspect_point',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'مؤشر الفحص:',
    th: 'ตำแหน่งตรวจสอบ:',
    en: 'Inspection Point:',
  },
  {
    id: 'eval_spectrum_freq_range',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'نطاق التردد (0 – 3,000 Hz)',
    th: 'ช่วงความถี่ (0 – 3,000 Hz)',
    en: 'Frequency Range (0 – 3,000 Hz)',
  },
  {
    id: 'eval_spectrum_original_sound',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'الصوت الأصلي:',
    th: 'เสียงต้นแบบ:',
    en: 'Original Voice:',
  },
  {
    id: 'eval_spectrum_user_sound',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'صوت المستخدم:',
    th: 'เสียงผู้เรียน:',
    en: 'User Voice:',
  },
  {
    id: 'eval_spectrum_diff',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'الفرق:',
    th: 'ความต่าง:',
    en: 'Difference:',
  },
  {
    id: 'eval_spectrum_teacher_legend',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'الصوت الأصلي (المعلم)',
    th: 'เสียงต้นแบบ (ครู)',
    en: 'Original Voice (Teacher)',
  },
  {
    id: 'eval_spectrum_user_legend',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'صوت المستخدم (المسجل)',
    th: 'เสียงผู้เรียน (บันทึกไว้)',
    en: 'User Voice (Recorded)',
  },
  {
    id: 'eval_spectrum_intensity',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'الشدة',
    th: 'ความดัง',
    en: 'Intensity',
  },
  {
    id: 'eval_spectrum_result_badge',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'نتيجة المقارنة',
    th: 'ผลการเปรียบเทียบ',
    en: 'Comparison Result',
  },
  {
    id: 'eval_spectrum_tone_match',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'التشابه في النغمة:',
    th: 'ความสอดคล้องของน้ำเสียง:',
    en: 'Tone Similarity:',
  },
  {
    id: 'eval_spectrum_match_ratio',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'نسبة التطابق:',
    th: 'อัตราความตรงกัน:',
    en: 'Match Ratio:',
  },
  {
    id: 'eval_spectrum_match_very_excellent',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'ممتاز جداً',
    th: 'ยอดเยี่ยมมาก',
    en: 'Very Excellent',
  },
  {
    id: 'eval_spectrum_match_excellent',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'ممتاز',
    th: 'ยอดเยี่ยม',
    en: 'Excellent',
  },
  {
    id: 'eval_spectrum_match_good',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'جيد',
    th: 'ดี',
    en: 'Good',
  },
  {
    id: 'eval_spectrum_match_medium',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'متوسط',
    th: 'ปานกลาง',
    en: 'Medium',
  },
  {
    id: 'eval_spectrum_match_repeat',
    category: 'practice',
    categoryLabel: 'صفحة تسجيل الصوت والنتائج',
    ar: 'يحتاج تكرار',
    th: 'ต้องทำซ้ำ',
    en: 'Needs Repetition',
  },
  {
    id: 'stats_syncing_answers1',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'جاري مزامنة الإنجازات مباشرة من ورقة answers 1...',
    th: 'กำลังซิงค์บันทึกความสำเร็จจากชีต answers 1...',
    en: 'Syncing achievements directly from sheet answers 1...',
  },
  {
    id: 'stats_total_practices',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'إجمالي التدريبات',
    th: 'การฝึกทั้งหมด',
    en: 'Total Practices',
  },
  {
    id: 'stats_accuracy_rate',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'معدل الدقة',
    th: 'ความแม่นยำเฉลี่ย',
    en: 'Accuracy Rate',
  },
  {
    id: 'stats_mastered_words',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'كلمات متقنة (ممتاز)',
    th: 'คำศัพท์ที่เชี่ยวชาญ (ยอดเยี่ยม)',
    en: 'Mastered Words (Excellent)',
  },
  {
    id: 'stats_recent_attempts',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'آخر المحاولات الصوتية:',
    th: 'การฝึกออกเสียงล่าสุด:',
    en: 'Recent Voice Attempts:',
  },
  {
    id: 'stats_clear_btn',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'مسح السجل',
    th: 'ล้างประวัติ',
    en: 'Clear History',
  },
  {
    id: 'stats_empty_note',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'لم تقم بأي تسجيل صوتي بعد. ابدأ بنطق الكلمات لترى تقييماتك هنا!',
    th: 'ยังไม่มีประวัติการบันทึกเสียง เริ่มฝึกออกเสียงคำศัพท์เพื่อดูผลการประเมินที่นี่!',
    en: 'No voice recordings yet. Start practicing words to view evaluations here!',
  },
  {
    id: 'stats_verified_in_sheet',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: '(موثق في ورقة answers 1)',
    th: '(บันทึกในชีต answers 1 แล้ว)',
    en: '(Recorded in answers 1 sheet)',
  },
  {
    id: 'stats_detected_label',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'سُمع:',
    th: 'ตรวจพบ:',
    en: 'Detected:',
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
            map.set(p.id, {
              ...existing,
              ar: p.ar !== undefined ? p.ar : existing.ar,
              th: p.th !== undefined ? p.th : existing.th,
              en: p.en !== undefined ? p.en : existing.en,
            });
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
 * If text was intentionally cleared (empty string), it returns empty string without falling back to defaults.
 */
export function getTranslatedString(
  key: string,
  lang: SupportedLang,
  items: TranslationItem[] = DEFAULT_TRANSLATIONS,
  fallbackAr?: string
): string {
  const item = items.find((i) => i.id === key);
  if (item) {
    const arVal = typeof item.ar === 'string' ? item.ar : '';
    const thVal = typeof item.th === 'string' ? item.th : '';
    const enVal = typeof item.en === 'string' ? item.en : '';

    // If all three languages were cleared by the admin, the text was intentionally removed!
    if (arVal.trim() === '' && thVal.trim() === '' && enVal.trim() === '') {
      return '';
    }

    if (lang === 'ar') {
      if (typeof item.ar === 'string') return item.ar;
      return fallbackAr ?? '';
    }

    if (lang === 'th') {
      if (typeof item.th === 'string') {
        if (item.th.trim() === '') {
          // If Thai was cleared, do not fallback to anything!
          return '';
        }
        return item.th;
      }
      return arVal.trim() ? item.ar : '';
    }

    if (lang === 'en') {
      if (typeof item.en === 'string') {
        if (item.en.trim() === '') {
          // If English was cleared, do not fallback to anything!
          return '';
        }
        return item.en;
      }
      return arVal.trim() ? item.ar : '';
    }
  }

  // If item not found:
  return fallbackAr !== undefined ? fallbackAr : '';
}

/**
 * Direct client-side translation via Google Translate (CORS friendly) & MyMemory API
 * Used whenever /api/translate is unavailable or returns an error.
 */
export async function translateClientSideDirect(text: string): Promise<{ th: string; en: string }> {
  const clean = (text || '').trim();
  if (!clean) return { th: '', en: '' };

  let th = '';
  let en = '';

  // 1. Google Translate GTX (Free, fast, CORS open)
  try {
    const [thRes, enRes] = await Promise.all([
      fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=th&dt=t&q=${encodeURIComponent(clean)}`),
      fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=en&dt=t&q=${encodeURIComponent(clean)}`),
    ]);
    if (thRes.ok) {
      const thJson = await thRes.json().catch(() => null);
      if (Array.isArray(thJson?.[0])) {
        th = thJson[0].map((p: any) => p[0] || '').join('').trim();
      }
    }
    if (enRes.ok) {
      const enJson = await enRes.json().catch(() => null);
      if (Array.isArray(enJson?.[0])) {
        en = enJson[0].map((p: any) => p[0] || '').join('').trim();
      }
    }
    if (th || en) {
      return { th, en };
    }
  } catch (err) {
    console.warn('Direct Google Translate notice:', err);
  }

  // 2. MyMemory API fallback (Free, open)
  try {
    const [thRes2, enRes2] = await Promise.all([
      fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=ar|th`),
      fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=ar|en`),
    ]);
    if (thRes2.ok) {
      const d = await thRes2.json().catch(() => null);
      if (d?.responseData?.translatedText) th = d.responseData.translatedText;
    }
    if (enRes2.ok) {
      const d = await enRes2.json().catch(() => null);
      if (d?.responseData?.translatedText) en = d.responseData.translatedText;
    }
  } catch (err2) {
    console.warn('Direct MyMemory notice:', err2);
  }

  return { th: th || clean, en: en || clean };
}

/**
 * Call Gemini translation API for a single text with zero-fail fallback
 */
export async function translateSingleWithAI(
  text: string,
  apiKey?: string
): Promise<{ th: string; en: string }> {
  const clean = (text || '').trim();
  if (!clean) return { th: '', en: '' };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-gemini-key'] = apiKey;

  // 1. Try backend /api/translate
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: clean }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.success !== false && (data.th || data.en)) {
        return { th: data.th || '', en: data.en || '' };
      }
    }
  } catch (err) {
    console.warn('Backend /api/translate not reachable, switching to direct client translator:', err);
  }

  // 2. Direct client-side translation fallback
  return await translateClientSideDirect(clean);
}

/**
 * Call Gemini translation API for multiple items at once with zero-fail fallback
 */
export async function translateBatchWithAI(
  items: { id: string; text: string }[],
  apiKey?: string
): Promise<Record<string, { th: string; en: string }>> {
  if (!items || items.length === 0) return {};

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-gemini-key'] = apiKey;

  // 1. Try backend /api/translate
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ items }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.success !== false && Array.isArray(data.translations)) {
        const result: Record<string, { th: string; en: string }> = {};
        data.translations.forEach((t: any) => {
          if (t.id) result[t.id] = { th: t.th || '', en: t.en || '' };
        });
        return result;
      }
    }
  } catch (err) {
    console.warn('Backend /api/translate batch error, using client-side translator:', err);
  }

  // 2. Direct client-side batch translation
  const result: Record<string, { th: string; en: string }> = {};
  await Promise.all(
    items.map(async (item) => {
      const trans = await translateClientSideDirect(item.text);
      result[item.id] = trans;
    })
  );
  return result;
}

/**
 * Reverse Template Resolver for Dynamic Evaluation Feedback:
 * Translates deterministic evaluation summaries, acoustic comparisons,
 * letter phoneme breakdowns, and answers 1 records instantly without latency.
 */
const EXACT_EVAL_MAP: Record<string, { th: string; en: string }> = {
  // Grades & Themes
  'ممتاز': { th: 'ยอดเยี่ยม', en: 'Excellent' },
  'ممتاز ومتقن': { th: 'ยอดเยี่ยมและแม่นยำ', en: 'Excellent and proficient' },
  'ممتاز جداً': { th: 'ยอดเยี่ยมมาก', en: 'Very Excellent' },
  'ممتاز جداً! نطق فصيح ومتقن': { th: 'ยอดเยี่ยมมาก! การออกเสียงถูกต้องและแม่นยำ', en: 'Excellent! Accurate and fluent articulation' },
  'نطق ممتاز ومتقن!': { th: 'การออกเสียงยอดเยี่ยมและแม่นยำ!', en: 'Excellent and accurate pronunciation!' },
  'ممتاز ورائع!': { th: 'ยอดเยี่ยมและน่าประทับใจ!', en: 'Excellent and wonderful!' },
  'رائع وممتاز': { th: 'ยอดเยี่ยมและน่าประทับใจ', en: 'Wonderful & Excellent' },
  'رائع ومتقن تماماً': { th: 'ยอดเยี่ยมและแม่นยำสมบูรณ์แบบ', en: 'Wonderful and fully accurate' },
  'رائع': { th: 'ยอดเยี่ยม', en: 'Wonderful' },
  'جيد جداً': { th: 'ดีมาก', en: 'Very Good' },
  'نطق جيد جداً!': { th: 'การออกเสียงดีมาก!', en: 'Very Good Pronunciation!' },
  'جيد جداً - مشجع': { th: 'ดีมาก - น่าชื่นชม', en: 'Very Good - Encouraging' },
  'جيد': { th: 'ดี', en: 'Good' },
  'جيد - خطوة ممتازة': { th: 'ดี - ก้าวหน้าที่ยอดเยี่ยม', en: 'Good - Excellent step' },
  'جيد - يحتاج تدريباً': { th: 'ดี - ต้องฝึกฝนเพิ่มเติม', en: 'Good - Needs practice' },
  'جيد - نقص في التكرار': { th: 'ดี - จำนวนครั้งไม่ครบ', en: 'Good - Incomplete repetitions' },
  'متوسط': { th: 'ปานกลาง', en: 'Medium' },
  'نطق مقبول مع ملاحظات': { th: 'การออกเสียงพอใช้ มีข้อควรปรับปรุง', en: 'Acceptable pronunciation with notes' },
  'يحتاج تدريب': { th: 'ต้องฝึกฝน', en: 'Needs practice' },
  'يحتاج تدريباً': { th: 'ต้องฝึกฝน', en: 'Needs practice' },
  'يحتاج تدريباً مكثفاً': { th: 'ต้องฝึกฝนอย่างเข้มข้น', en: 'Needs intensive practice' },
  'يحتاج إلى مزيد من التمرين': { th: 'ต้องฝึกฝนเพิ่มเติม', en: 'Needs more practice' },
  'يحتاج تكرار': { th: 'ต้องทำซ้ำ', en: 'Needs repetition' },
  'لم يكتمل التكرار': { th: 'ทำซ้ำไม่ครบ', en: 'Incomplete repetition' },
  'غير مكتمل التكرار': { th: 'ทำซ้ำไม่ครบตามกำหนด', en: 'Incomplete repetition count' },
  'غير مطابق': { th: 'ไม่ตรงกับคำเป้าหมาย', en: 'Not matched' },
  'معتمد': { th: 'ผ่านการรับรอง', en: 'Approved' },
  'صحيح': { th: 'ถูกต้อง', en: 'Correct' },
  'يحتاج تحسين': { th: 'ต้องปรับปรุง', en: 'Needs improvement' },
  'مفقود': { th: 'ไม่ปรากฏ', en: 'Missing' },

  // Long Feedback Messages
  'إتقان تام وتجويد فصيح لكافة الحركات والمخارج!': {
    th: 'ยอดเยี่ยมสมบูรณ์แบบ ทั้งสระและฐานเกิดเสียงอย่างถูกต้อง!',
    en: 'Complete mastery and eloquent articulation of all vowels and phonemes!',
  },
  'نطق ممتاز جداً! مخارج الحروف نقية وواضحة.': {
    th: 'การออกเสียงยอดเยี่ยมมาก! ฐานเกิดเสียงของพยัญชนะชัดเจนและบริสุทธิ์',
    en: 'Very excellent pronunciation! Articulation points are clear and pure.',
  },
  'أحسنت صنعاً! نطقك للكلمة فصيح ومتقن وواضح المخارج.': {
    th: 'ทำได้ดีมาก! การออกเสียงคำศัพท์ชัดเจน ถูกต้อง และแม่นยำ',
    en: 'Well done! Your pronunciation is eloquent, accurate, and clear.',
  },
  'أحسنت! نطق ممتاز ومشجع، بداية موفقة جداً!': {
    th: 'ยอดเยี่ยม! การออกเสียงดีเยี่ยมและน่าประทับใจ เริ่มต้นได้ดีมาก!',
    en: 'Well done! Excellent and encouraging pronunciation, great start!',
  },
  'ما شاء الله! نطق متقن ورائع من حيث وضوح الصوت وزمن الحروف والمدود.': {
    th: 'ยอดเยี่ยมมาก! การออกเสียงชัดเจน ทั้งจังหวะพยัญชนะและสระเสียงยาว',
    en: 'Wonderful! Accurate pronunciation with clear voice and balanced vowel timing.',
  },
  'أحسنت جداً! أداء صوتي ممتاز وإيقاع نطق واضح ومتوازن.': {
    th: 'ทำได้ดีมาก! น้ำเสียงยอดเยี่ยม จังหวะการออกเสียงชัดเจนและสมดุล',
    en: 'Very well done! Excellent vocal performance and balanced speech rhythm.',
  },
  'أداء جيد جداً! صوتك واضح ومسموع، استمر في التدريب للوصول لدرجة الإتقان الكامل.': {
    th: 'ผลงานดีมาก! เสียงชัดเจน ได้ยินชัด ฝึกฝนต่อไปเพื่อความสมบูรณ์แบบ',
    en: 'Very good performance! Clear voice, keep practicing for complete perfection.',
  },
  'أداء جيد جداً، هناك بعض الحروف أو الحركات تحتاج تركيزاً طفيفاً.': {
    th: 'ผลงานดีมาก มีบางพยัญชนะหรือสระที่ต้องเน้นย้ำอีกเล็กน้อย',
    en: 'Very good performance, a few letters or vowels need slight focus.',
  },
  'أداء جيد جداً، مع ملاحظة تدقيق إضافي على الحركات الدقيقة.': {
    th: 'ผลงานดีมาก ควรระวังการออกเสียงสระละเอียดเพิ่มเติม',
    en: 'Very good performance, pay extra attention to subtle diacritics.',
  },
  'نطق جيد جداً ومقبول، واصل التدريب!': {
    th: 'การออกเสียงดีมากและผ่านเกณฑ์ ฝึกฝนต่อไป!',
    en: 'Very good and acceptable pronunciation, keep training!',
  },
  'محاولة جيدة! حاول ضبط إيقاع الكلمة والتأني في نطق الحركات والمدود.': {
    th: 'ความพยายามที่ดี! พยายามรักษาจังหวะและไม่รีบในสระเสียงยาว',
    en: 'Good attempt! Try to balance word rhythm and take time on long vowels.',
  },
  'محاولة جيدة، استمع للصوت النموذجي وكرر.': {
    th: 'ความพยายามที่ดี ลองฟังเสียงต้นแบบแล้วพูดตามอีกครั้ง',
    en: 'Good attempt, listen to the model audio and repeat.',
  },
  'بداية طيبة، استمع مجدداً للنموذج الصوتي وحاول تقليد مخرج الحرف بدقة.': {
    th: 'การเริ่มต้นที่ดี ฟังเสียงต้นแบบอีกครั้งและฝึกเลียนแบบฐานเกิดเสียงให้ตรง',
    en: 'Good start, listen to the model audio again and try to mimic the articulation.',
  },
  'أحسنت! نطق صحيح، مع ملاحظة عدم إشباع الحركة القصيرة لحرف مد.': {
    th: 'เก่งมาก! ออกเสียงถูกต้อง ระวังอย่ายืดสระเสียงสั้นให้กลายเป็นสระเสียงยาว',
    en: 'Well done! Correct pronunciation, note not to prolong short vowels into long ones.',
  },
  'الكلمة المنطوقة تختلف عن الكلمة المستهدفة، استمع للنطق النموذجي وأعد المحاولة.': {
    th: 'คำที่ออกเสียงต่างจากคำเป้าหมาย โปรดฟังเสียงต้นแบบแล้วลองใหม่อีกครั้ง',
    en: 'Spoken word differs from target word, listen to model audio and retry.',
  },
  'في المستوى المتقدم يلزم نطق كل حركة بدقة تامة دون تساهل.': {
    th: 'ในระดับขั้นสูง จำเป็นต้องออกเสียงทุกสระอย่างแม่นยำที่สุด',
    en: 'At advanced level, every single diacritic must be pronounced accurately.',
  },
  'لم نتمكن من سماع نطق واضح في التسجيل، يرجى التحدث بالقرب من الميكروفون.': {
    th: 'ไม่ได้ยินเสียงที่ชัดเจน โปรดเข้าใกล้ไมโครโฟนแล้วออกเสียงอีกครั้ง',
    en: 'Could not detect clear speech, please speak closer to the microphone.',
  },
  'تعذر على محرك Whisper الداخلي تحليل الصوت. لم يتم التبديل لأي نظام آخر بناءً على الإعدادات. يرجى إعادة المحاولة والتحدث بوضوح.': {
    th: 'ไม่สามารถวิเคราะห์เสียงได้ โปรดลองอีกครั้งและออกเสียงให้ชัดเจน',
    en: 'Could not analyze audio. Please retry and speak clearly.',
  },

  // Acoustic Duration Comparisons
  'نطقك أسرع من صوت المعلم؛ أعطِ حروف المد والحركات القصيرة حقها الزمني دون تعجل.': {
    th: 'การออกเสียงของคุณเร็วกว่าครู ให้เวลากับสระเสียงยาวและสระสั้นอย่างพอดี ไม่ควรรีบ',
    en: 'Your speech is faster than teacher; give vowels and diacritics proper duration without rushing.',
  },
  'نطقك أطول من المعتاد؛ تجنّب إطالة الحركات القصيرة لتصبح حروف مد.': {
    th: 'การออกเสียงยาวเกินไป ระวังอย่ายืดสระเสียงสั้นจนกลายเป็นสระเสียงยาว',
    en: 'Your speech is longer than usual; avoid prolonging short vowels into long ones.',
  },
  'تناسق صوتي ونغمي ممتاز مع مخارج حروف المعلم وسرعة النطق النموذجية.': {
    th: 'ความสอดคล้องของน้ำเสียง จังหวะ และฐานเสียงยอดเยี่ยม ตรงกับครูผู้สอน',
    en: 'Excellent acoustic and tone harmony matching teacher articulation and rhythm.',
  },

  // Letter Comments & Breakdown
  'نطق سليم ومتقن لصوت أو اسم الحرف': {
    th: 'ออกเสียงฐานเสียงหรือชื่อพยัญชนะได้ถูกต้องแม่นยำ',
    en: 'Sound and accurate articulation of letter phoneme or name',
  },
  'تم نطقه بدقة ووضوح': {
    th: 'ออกเสียงได้อย่างชัดเจนและแม่นยำ',
    en: 'Pronounced with precision and clarity',
  },
  'نطق سليم وواضح': {
    th: 'การออกเสียงถูกต้องและชัดเจน',
    en: 'Sound and clear pronunciation',
  },
  'تم نطقه بدقة وفي موضعه': {
    th: 'ออกเสียงได้ตรงตำแหน่งและแม่นยำ',
    en: 'Pronounced accurately in its correct position',
  },
  'نطق سليم ومتوازن': {
    th: 'การออกเสียงถูกต้องและสมดุล',
    en: 'Sound and balanced pronunciation',
  },
  'أعطِ الحرف حقه في نهاية النطق': {
    th: 'ให้ความสำคัญกับพยัญชนะตัวสุดท้ายของคำ',
    en: 'Give the letter full articulation at the end',
  },
  'الحرف وُجد لكن بترتيب أو موضع غير مضبوط': {
    th: 'พบพยัญชนะแต่ตำแหน่งหรือลำดับยังไม่ถูกต้อง',
    en: 'Letter found but order or position needs adjustment',
  },
  'الحرف لم يظهر في الصوت المنطوق': {
    th: 'ไม่พบพยัญชนะนี้ในเสียงที่พูด',
    en: 'Letter was not detected in spoken audio',
  },

  // Articulation Guidance & Vowels
  'أحسنت! مخارج الحروف نقية وصحيحة.': {
    th: 'ยอดเยี่ยม! ฐานเกิดเสียงของพยัญชนะถูกต้องและบริสุทธิ์',
    en: 'Well done! Phoneme articulation is pure and accurate.',
  },
  'أداء صوتي فصيح وسليم.': {
    th: 'การออกเสียงไพเราะและถูกต้อง',
    en: 'Eloquent and sound vocal performance.',
  },
  'متطابقة مع التشكيل': {
    th: 'ถูกต้องตรงตามเครื่องหมายสระ',
    en: 'Matches diacritics accurately',
  },
  'استمر على هذا المستوى الرائع في تفخيم المفخم وترقيق المرقق.': {
    th: 'รักษามาตรฐานที่ยอดเยี่ยมในการแยกเสียงหนาและเสียงบางต่อไป',
    en: 'Keep up this excellent level of heavy and light letter distinction.',
  },
  'تم رصد امتداد زمني جيد للمدود والحركات': {
    th: 'ตรวจพบการยืดจังหวะสระเสียงยาวอย่างเหมาะสม',
    en: 'Good duration observed for long vowels and diacritics',
  },
  'وضوح متناسق في الحركات القصيرة وإيقاع النطق': {
    th: 'สระเสียงสั้นชัดเจนและจังหวะการออกเสียงสม่ำเสมอ',
    en: 'Consistent clarity in short vowels and rhythm',
  },
  'احرص على إخراج الحروف من مخارجها الصحيحة وضبط حركات الفم مع كل حركة (فتح، ضم، كسر).': {
    th: 'โปรดระวังการออกเสียงจากฐานเกิดเสียงที่ถูกต้องและรูปปากในแต่ละสระ (ฟัตฮะฮ์, ด็อมมะฮ์, กัสเราะฮ์)',
    en: 'Ensure articulating letters from their proper points and adjust mouth shape for each vowel.',
  },
  'رصد الذبذبات الصوتية': {
    th: 'การตรวจจับคลื่นความถี่เสียง',
    en: 'Acoustic wave detection',
  },
  'تسجيل صوتي': {
    th: 'บันทึกเสียง',
    en: 'Voice recording',
  },
};

/**
 * Single evaluation phrase translator (used internally by compound resolver)
 */
function resolveSingleEvaluationPhrase(
  rawText: string,
  lang: SupportedLang,
  items?: TranslationItem[]
): string {
  const text = (rawText || '').trim();
  if (!text) return '';
  if (lang === 'ar') return text;

  // 1. Direct dictionary lookup
  if (EXACT_EVAL_MAP[text]) {
    return EXACT_EVAL_MAP[text][lang] || text;
  }

  // 2. Custom translations lookup (if admin configured it)
  if (items && items.length > 0) {
    const matchItem = items.find((i) => (i.ar || '').trim() === text);
    if (matchItem) {
      if (lang === 'th' && matchItem.th?.trim()) return matchItem.th.trim();
      if (lang === 'en' && matchItem.en?.trim()) return matchItem.en.trim();
    }
  }

  // 3. Dynamic Regex Patterns (Parameterized Templates)

  // Pattern: نطق رائع ومتقن لمخرج وصوت حرف (س)!
  const singleLetterMatch = text.match(/نطق رائع ومتقن لمخرج وصوت حرف \((.+?)\)!?/);
  if (singleLetterMatch) {
    const letter = singleLetterMatch[1];
    return lang === 'th'
      ? `การออกเสียงยอดเยี่ยมและถูกต้องสำหรับฐานเสียงพยัญชนะ (${letter})!`
      : `Wonderful and accurate articulation for letter (${letter})!`;
  }

  // Pattern: أحسنت صنعاً! تم نطق وتكرار حرف (ب) بنجاح (3 مرات) بمخارج سليمة.
  const letterRepeatMatch = text.match(/أحسنت صنعاً! تم نطق وتكرار حرف \((.+?)\) بنجاح \((\d+) مرات\) بمخارج سليمة\.?/);
  if (letterRepeatMatch) {
    const [, letter, count] = letterRepeatMatch;
    return lang === 'th'
      ? `ทำได้ดีมาก! ออกเสียงและทำซ้ำพยัญชนะ (${letter}) สำเร็จ (${count} ครั้ง) ด้วยฐานเสียงที่ถูกต้อง`
      : `Well done! Successfully articulated and repeated letter (${letter}) (${count} times) accurately.`;
  }

  // Pattern: أحسنت صنعاً! تم نطق وتكرار المقطع (قُمْ) بنجاح (3 مرات).
  const syllableRepeatMatch = text.match(/أحسنت صنعاً! تم نطق وتكرار المقطع \((.+?)\) بنجاح \((\d+) مرات\)\.?/);
  if (syllableRepeatMatch) {
    const [, syl, count] = syllableRepeatMatch;
    return lang === 'th'
      ? `ทำได้ดีมาก! ออกเสียงและทำซ้ำพยางค์ (${syl}) สำเร็จ (${count} ครั้ง)`
      : `Well done! Successfully repeated syllable (${syl}) (${count} times).`;
  }

  // Pattern: أحسنت صنعاً! نطق صحيح ومتقن للمقطع (قُمْ).
  const syllableSingleMatch = text.match(/أحسنت صنعاً! نطق صحيح ومتقن للمقطع \((.+?)\)\.?/);
  if (syllableSingleMatch) {
    const syl = syllableSingleMatch[1];
    return lang === 'th'
      ? `ทำได้ดีมาก! ออกเสียงพยางค์ (${syl}) ถูกต้องและแม่นยำ`
      : `Well done! Accurate pronunciation of syllable (${syl}).`;
  }

  // Pattern: رائع جداً! تم التحقق من تكرار الكلمة (3 مرات متتالية) بنجاح عبر التحليل الصوتي لنبضات الطاقة...
  const energyRepeatMatch = text.match(/رائع جداً! تم التحقق من تكرار الكلمة \((\d+) مرات متتالية\) بنجاح/);
  if (energyRepeatMatch) {
    const count = energyRepeatMatch[1];
    return lang === 'th'
      ? `ยอดเยี่ยมมาก! ยืนยันการทำซ้ำคำศัพท์ (${count} ครั้งต่อเนื่อง) สำเร็จ ฐานเกิดเสียงถูกต้องชัดเจน`
      : `Awesome! Successfully verified word repetition (${count} consecutive times) with clear articulation.`;
  }

  // Pattern: رائع جداً! أكملت تكرار الكلمة بنجاح (3 مرات من 3 مطلوبة) بنطق واضح ومخارج سليمة.
  const wordCompleteMatch = text.match(/رائع جداً! أكملت تكرار الكلمة بنجاح \((\d+) مرات من (\d+) مطلوبة\)/);
  if (wordCompleteMatch) {
    const [, detected, required] = wordCompleteMatch;
    return lang === 'th'
      ? `ยอดเยี่ยมมาก! ทำซ้ำคำศัพท์สำเร็จ (${detected} ครั้ง จากที่กำหนด ${required} ครั้ง) ด้วยการออกเสียงที่ชัดเจน`
      : `Awesome! Successfully completed word repetitions (${detected} of ${required} required) with clear articulation.`;
  }

  // Pattern: أحسنت! كررت الكلمة 2 من 3 مرات بنطق جيد في المستوى السهل.
  const easyPartialMatch = text.match(/أحسنت! كررت الكلمة (\d+) من (\d+) مرات/);
  if (easyPartialMatch) {
    const [, detected, required] = easyPartialMatch;
    return lang === 'th'
      ? `เก่งมาก! ทำซ้ำคำศัพท์ ${detected} จาก ${required} ครั้ง ด้วยการออกเสียงที่ดีในระดับง่าย`
      : `Well done! Repeated the word ${detected} of ${required} times with good pronunciation in easy mode.`;
  }

  // Pattern: نطقك صحيح ولكنك كررت الكلمة... من أصل...
  const partialRepNotice = text.match(/نطقك صحيح ولكنك كررت الكلمة (\d+).*من أصل (\d+) مرات مطلوبة/);
  if (partialRepNotice) {
    const [, detected, required] = partialRepNotice;
    return lang === 'th'
      ? `ออกเสียงถูกต้อง แต่ทำซ้ำเพียง ${detected} จาก ${required} ครั้งที่กำหนด กรุณาทำให้ครบตามจำนวน`
      : `Correct pronunciation, but you only repeated ${detected} of ${required} required times. Please complete repetitions.`;
  }

  // Pattern: المطلوب تكرار الكلمة (3 مرات)...
  const requiredRepNotice = text.match(/المطلوب تكرار الكلمة \((\d+) مرات\)/);
  if (requiredRepNotice) {
    const count = requiredRepNotice[1];
    return lang === 'th'
      ? `ต้องทำซ้ำคำศัพท์ (${count} ครั้ง) ตรวจไม่พบคำเป้าหมายชัดเจน โปรดลองใหม่อีกครั้ง`
      : `Required to repeat the word (${count} times). Target word not detected clearly, please retry.`;
  }

  // Pattern: سُمع بدلاً منه: س
  const heardInsteadMatch = text.match(/سُمع بدلاً منه:\s*(.+)/);
  if (heardInsteadMatch) {
    const char = heardInsteadMatch[1];
    return lang === 'th' ? `ได้ยินเป็นเสียง: ${char} แทน` : `Heard instead: ${char}`;
  }

  // Pattern: نطق قريب ومقبول في المستوى السهل (س ≈ ص)
  const phoneticCousinMatch = text.match(/نطق قريب ومقبول في المستوى السهل \((.+?)\s*≈\s*(.+?)\)/);
  if (phoneticCousinMatch) {
    const [, c1, c2] = phoneticCousinMatch;
    return lang === 'th'
      ? `การออกเสียงใกล้เคียงและยอมรับได้ในระดับง่าย (${c1} ≈ ${c2})`
      : `Close and acceptable articulation in easy mode (${c1} ≈ ${c2})`;
  }

  return text;
}

/**
 * Translate any evaluation feedback string (compound or single) into the active language.
 * Preserves Arabic in sheet "answers 1" while presenting crystal-clear native translations to the student.
 */
export function translateEvaluationFeedback(
  arabicFeedback: string | undefined | null,
  lang: SupportedLang,
  items?: TranslationItem[]
): string {
  if (!arabicFeedback || !arabicFeedback.trim()) return '';
  if (lang === 'ar') return arabicFeedback;

  const raw = arabicFeedback.trim();

  // If compound format (e.g. "نطق ممتاز ومتقن! - إتقان تام وتجويد فصيح...")
  if (raw.includes(' - ')) {
    const parts = raw.split(' - ');
    const translatedParts = parts.map((part) => resolveSingleEvaluationPhrase(part, lang, items));
    return translatedParts.join(' - ');
  }

  return resolveSingleEvaluationPhrase(raw, lang, items);
}
