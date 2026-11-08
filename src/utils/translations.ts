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
    id: 'home_card_extra1',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'دقة عالية في مخارج الحروف',
    th: 'ความแม่นยำสูงในฐานเกิดเสียง',
    en: 'High Precision in Phoneme Articulation',
    isSheetLinked: true,
    sheetSourceNote: 'مرتبط بالنص الإضافي 1 في ورقة الرئيسية (B25)',
  },
  {
    id: 'home_card_extra2',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'مقارنة فيزيائية بالترددات',
    th: 'การเปรียบเทียบคลื่นเสียงเชิงฟิสิกส์',
    en: 'Physical Frequency Comparison',
    isSheetLinked: true,
    sheetSourceNote: 'مرتبط بالنص الإضافي 2 في ورقة الرئيسية (B26)',
  },
  {
    id: 'home_card_extra3',
    category: 'home',
    categoryLabel: 'نافذة التسجيل والصفحة الرئيسية',
    ar: 'توثيق فوري للدرجات',
    th: 'บันทึกคะแนนอัตโนมัติ',
    en: 'Instant Score Logging',
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
