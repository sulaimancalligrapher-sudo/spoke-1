export type EvaluationMode = 'acoustic' | 'ai' | 'local';

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
  driveFolderId?: string; // معرف مجلد Google Drive للأصوات
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
