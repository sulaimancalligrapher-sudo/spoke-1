export type EvaluationMode = 'acoustic' | 'ai' | 'local' | 'whisper';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface AcousticWaveformMetrics {
  speechDuration: number;
  expectedDuration: number;
  durationMatchPercent: number;
  energyLevel: number; // 0-100
  voiceActivityDetected: boolean;
  rhythmScore: number; // 0-100
  spectralClarityScore: number; // 0-100
}

export interface WordItem {
  id: string;
  word: string; // with Tashkeel
  plainWord: string; // stripped of Tashkeel
  meaning: string; // المعنى والتوضيح
  category: string; // 'الحرف' | 'الكلمة' | 'الجملة' أو أي فئة مخصصة
  lessonSubject: string; // موضوع الدرس
  level?: number;
  imageUrl?: string; // رابط الصورة
  audioUrl?: string; // رابط الصوت
  autoReadText?: string; // نص مخصص للقراءة الآلية في حال عدم وجود ملف صوتي
  makhrajTip: string; // إرشادات المخرج الصوتي
  letterFocus?: string;
  harakat?: string;
  transliteration?: string;
  repeatCount?: number; // عدد مرات التكرار المطلوبة (افتراضي 1)
  difficultyLevel?: DifficultyLevel; // مستوى تدقيق النطق: 'easy' (سهل) | 'medium' (متوسط) | 'hard' (متقدم)
  recordingDuration?: number; // مدة التسجيل المخصصة بالثواني (افتراضي 5 ثوانٍ)
}

export interface LetterPhoneme {
  letter: string;
  status: 'صحيح' | 'يحتاج تحسين' | 'مفقود';
  comment?: string;
}

export interface PronunciationEvaluation {
  score: number;
  grade: string;
  isMatch: boolean;
  feedback: string;
  makhrajAdvice: string;
  vowelAccuracy: string;
  detectedWord: string;
  letterBreakdown: LetterPhoneme[];
  timestamp: number;
  recordedAudioUrl?: string;
  engineUsed: EvaluationMode;
  engineNotice?: string;
  acousticMetrics?: AcousticWaveformMetrics;
  repetitionsDetected?: number; // عدد التكرارات التي رصدها النظام
  requiredRepetitions?: number; // عدد التكرارات المطلوبة
  repetitionsVerifiedByEnergy?: boolean; // هل تم التحقق من التكرار عبر نبضات الطاقة الفيزيائية
  difficultyLevel?: DifficultyLevel; // مستوى التدقيق المطبق
  textMatchScore?: number; // نسبة مطابقة النص مع النموذج
  acousticMatchScore?: number; // نسبة مطابقة البصمة الصوتية مع تسجيل المعلم
  acousticComparison?: {
    similarityScore: number;
    durationRatio: number;
    teacherDuration: number;
    studentDuration: number;
    feedback: string;
  };
}

export interface PracticeHistoryItem {
  id: string;
  wordId: string;
  word: string;
  score: number;
  grade: string;
  timestamp: number;
  spokenText: string;
  recordedAudioUrl?: string;
  studentName?: string;
  engineUsed?: EvaluationMode;
}

export interface AudioSettings {
  speed: number;
  engine: 'browser' | 'gemini';
  autoPlayTarget: boolean;
  repeatTargetTwice: boolean;
  preferredEvaluationMode: EvaluationMode;
  studentName: string;
  geminiApiKey?: string;
}

export interface GoogleSheetsConfig {
  enabled: boolean;
  webhookUrl: string;
  autoSync: boolean;
  lastSyncTime?: number;
  driveFolderId?: string; // معرف مجلد أصوات المعلم للتوافق
  teacherDriveFolderId?: string; // معرف مجلد أصوات المعلم والإدارة (الافتراضي: 1YuCKWxGjQn9E2EAKqoKN-7-Kl_UeDC4t)
  studentDriveFolderId?: string; // معرف مجلد تسجيلات أصوات الطلاب (الافتراضي: 1o80NgUVp64TwTt_yRn3I83c6gy8Ce1iA)
  syncCurriculumFromSheets?: boolean; // مزامنة الدروس من ورقة "الدروس"
}

export interface StudentSubmissionRecord {
  id: string;
  studentName: string;
  word: string;
  score: number;
  grade: string;
  detectedWord: string;
  feedback: string;
  engineUsed: EvaluationMode;
  timestamp: number;
  syncedToSheets: boolean;
}

export interface StudentRegistrant {
  id: string; // رقم المشترك ID
  name: string; // اسم المشترك
  registeredAt?: number;
}

export interface SocialLinkItem {
  url: string;
  iconKey: string; // 'line' | 'facebook' | 'instagram' | 'youtube' | 'x' | 'whatsapp' | 'telegram' | 'tiktok' | 'web'
  label?: string;
}

export interface HomeCardConfig {
  cardLogoUrl?: string; // B21: رابط صورة الشعار
  cardBgUrl?: string; // B22: رابط صورة خلفية للبطاقة
  cardTitle?: string; // B23: نص العنوان
  cardSubtitle?: string; // B24: نص وصف العنوان
  extraText1?: string; // B25: نص إضافي 1
  extraText2?: string; // B26: نص إضافي 2
  extraText3?: string; // B27: نص إضافي 3
}

export interface AdminUserRecord {
  name: string;
  pin: string;
  blocked: boolean; // if cell contains 'لا' -> blocked from entering
}

export interface Answers1ExerciseDetail {
  word: string;
  spokenText: string;
  audioUrl?: string;
  score: number;
  grade: string;
}

export interface Answers1SubmissionRow {
  rowIndex: number;
  timestamp: string;
  studentId: string;
  studentName: string;
  lessonSubject: string;
  status: string;
  totalExercises: number;
  exercises: Answers1ExerciseDetail[];
}

export interface HomeBrandConfig {
  logoUrl?: string; // B2: شعار الشريط العلوي
  title?: string; // B3: عنوان المنصة في الشريط العلوي
  subtitle?: string; // B4: وصف الشريط العلوي
  socialLinks: SocialLinkItem[]; // B8:C17
  card?: HomeCardConfig; // B21:B27: بطاقة الصفحة الرئيسية
  adminUsers?: AdminUserRecord[]; // D2:F31: أسماء الإداريين وأرقام الدخول وحالة المنع
}

export interface MatchingPair {
  id: string;
  rightText: string;
  leftText: string;
}

export interface MatchingExercise {
  id: string;
  exerciseNumber: number; // 1, 2, 3...
  questionText: string;
  pairs: MatchingPair[];
  lockOnMistake?: boolean; // لا يمكن التراجع عن الإجابة عند الخطأ (تثبيت الخطأ)
  showMistakeFeedback?: boolean; // إظهار الخطأ فوراً (افتراضياً true) أو إخفاؤه حتى النهاية (false)
}

export interface MatchingLessonSubject {
  id: string;
  subjectName: string;
  exercises: MatchingExercise[];
}

export interface MatchingSubmissionResult {
  exerciseNumber: number;
  totalPairs: number;
  correctCount: number;
  wrongCount: number;
  percentage: number;
  summaryString: string; // e.g. "(5 - الصحيح 4 - الخطأ 1 = 80%)"
}

