export type PracticeCategory = 'letters' | 'words' | 'minimal-pairs' | 'sentences' | 'custom';

export type EvaluationMode = 'local' | 'ai';

export interface WordItem {
  id: string;
  word: string; // with Tashkeel
  plainWord: string; // stripped of Tashkeel
  meaning: string;
  category: PracticeCategory;
  level: number;
  makhrajTip: string;
  letterFocus?: string;
  harakat?: string;
  transliteration?: string;
  audioExampleUrl?: string;
  lessonName?: string;
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
  speed: number; // 0.7 | 0.9 | 1.1
  engine: 'browser' | 'gemini';
  autoPlayTarget: boolean;
  repeatTargetTwice: boolean;
  preferredEvaluationMode: EvaluationMode;
  studentName: string;
}

export interface GoogleSheetsConfig {
  enabled: boolean;
  webhookUrl: string;
  autoSync: boolean;
  lastSyncTime?: number;
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
