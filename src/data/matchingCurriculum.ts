import { MatchingLessonSubject } from '../types';

export const INITIAL_MATCHING_SUBJECTS: MatchingLessonSubject[] = [
  {
    id: 'match-subj-1',
    subjectName: 'الكلمة وضدها',
    exercises: [
      {
        id: 'match-ex-1-1',
        exerciseNumber: 1,
        questionText: 'صِلْ بَيْنَ الكَلِمَةِ وَضِدِّهَا فِي المَعْنَى',
        pairs: [
          { id: 'p-1', rightText: 'كَبِير', leftText: 'صَغِير' },
          { id: 'p-2', rightText: 'طَوِيل', leftText: 'قَصِير' },
          { id: 'p-3', rightText: 'جَدِيد', leftText: 'قَدِيم' },
          { id: 'p-4', rightText: 'قَرِيب', leftText: 'بَعِيد' },
          { id: 'p-5', rightText: 'سَرِيع', leftText: 'بَطِيء' },
        ],
      },
      {
        id: 'match-ex-1-2',
        exerciseNumber: 2,
        questionText: 'صِلْ بَيْنَ الكَلِمَةِ وَعَكْسِهَا',
        pairs: [
          { id: 'p-6', rightText: 'نَهَار', leftText: 'لَيْل' },
          { id: 'p-7', rightText: 'نُور', leftText: 'ظَلَام' },
          { id: 'p-8', rightText: 'حَارّ', leftText: 'بَارِد' },
          { id: 'p-9', rightText: 'سَهْل', leftText: 'صَعْب' },
          { id: 'p-10', rightText: 'فَرَح', leftText: 'حُزْن' },
        ],
      },
    ],
  },
  {
    id: 'match-subj-2',
    subjectName: 'المفرد والجمع',
    exercises: [
      {
        id: 'match-ex-2-1',
        exerciseNumber: 1,
        questionText: 'صِلْ بَيْنَ الكَلِمَةِ المُفْرَدَةِ وَجَمْعِهَا المُنَاسِبِ',
        pairs: [
          { id: 'p-11', rightText: 'كِتَاب', leftText: 'كُتُب' },
          { id: 'p-12', rightText: 'قَلَم', leftText: 'أَقْلَام' },
          { id: 'p-13', rightText: 'بَاب', leftText: 'أَبْوَاب' },
          { id: 'p-14', rightText: 'بَيْت', leftText: 'بُيُوت' },
          { id: 'p-15', rightText: 'وَلَد', leftText: 'أَوْلَاد' },
        ],
      },
      {
        id: 'match-ex-2-2',
        exerciseNumber: 2,
        questionText: 'صِلْ كُلَّ اسْمٍ مُفْرَدٍ بِجَمْعِهِ الصَّحِيحِ',
        pairs: [
          { id: 'p-16', rightText: 'مَدْرَسَة', leftText: 'مَدَارِس' },
          { id: 'p-17', rightText: 'طَالِب', leftText: 'طُلَّاب' },
          { id: 'p-18', rightText: 'عَالِم', leftText: 'عُلَمَاء' },
          { id: 'p-19', rightText: 'شَجَرَة', leftText: 'أَشْجَار' },
          { id: 'p-20', rightText: 'صَدِيق', leftText: 'أَصْدِقَاء' },
        ],
      },
    ],
  },
  {
    id: 'match-subj-3',
    subjectName: 'الكلمة ومرادفها',
    exercises: [
      {
        id: 'match-ex-3-1',
        exerciseNumber: 1,
        questionText: 'صِلْ بَيْنَ الكَلِمَاتِ الَّتِي لَهَا نَفْسُ المَعْنَى (المُرَادِفَات)',
        pairs: [
          { id: 'p-21', rightText: 'بَيْت', leftText: 'مَنْزِل' },
          { id: 'p-22', rightText: 'سُرُور', leftText: 'فَرَح' },
          { id: 'p-23', rightText: 'أَمَل', leftText: 'رَجَاء' },
          { id: 'p-24', rightText: 'جَمِيل', leftText: 'حَسَن' },
          { id: 'p-25', rightText: 'سَبِيل', leftText: 'طَرِيق' },
        ],
      },
    ],
  },
];
