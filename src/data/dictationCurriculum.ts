import { DictationLessonSubject } from '../types';

export const INITIAL_DICTATION_SUBJECTS: DictationLessonSubject[] = [
  {
    id: 'dict-subj-1',
    subjectName: 'الحروف والكلمات التأسيسية',
    exercises: [
      {
        id: 'dict-1-1',
        exerciseNumber: 1,
        questionText: 'رتب الحروف لتكوين كلمة «باب»',
        scrambledPool: 'ب ا ب ف ر',
        correctAnswer: 'باب',
        settingsString: 'السماح بالإعادة | 5 ثواني',
        durationSeconds: 5,
        allowRetry: true,
      },
      {
        id: 'dict-1-2',
        exerciseNumber: 2,
        questionText: 'أكمل الحرف الناقص في كلمة «السَّلام»',
        scrambledPool: 'ـسـ ـكـ ك س سـ',
        correctAnswer: 'الـ|ـسـ|ـلام',
        settingsString: 'السماح بالإعادة | 5 ثواني',
        durationSeconds: 5,
        allowRetry: true,
      },
      {
        id: 'dict-1-3',
        exerciseNumber: 3,
        questionText: 'رتب الحروف لتكوين جملة «السلام عليكم»',
        scrambledPool: 'ا ل س لا م ع ل ي ك م',
        correctAnswer: 'السلام عليكم',
        settingsString: 'السماح بالإعادة | 5 ثواني',
        durationSeconds: 5,
        allowRetry: true,
      },
    ],
  },
  {
    id: 'dict-subj-2',
    subjectName: 'بناء الجمل العربية',
    exercises: [
      {
        id: 'dict-2-1',
        exerciseNumber: 1,
        questionText: 'رتب الكلمات لتكوين جملة صحيحة',
        scrambledPool: 'المدرسة ذهب إلى محمد',
        correctAnswer: 'ذهب محمد إلى المدرسة',
        settingsString: 'السماح بالإعادة | 5 ثواني',
        durationSeconds: 5,
        allowRetry: true,
      },
      {
        id: 'dict-2-2',
        exerciseNumber: 2,
        questionText: 'أكمل الكلمة الناقصة في الجملة',
        scrambledPool: 'إلى نام جلس',
        correctAnswer: 'ذهب محمد | إلى | المدرسة',
        settingsString: 'السماح بالإعادة | 5 ثواني',
        durationSeconds: 5,
        allowRetry: true,
      },
    ],
  },
];
