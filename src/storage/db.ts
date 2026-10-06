import {
  SchoolSettings,
  ClassItem,
  SectionItem,
  SubjectItem,
  GradeBoundary,
  PsychomotorItem,
  Student,
  AssessmentRecord,
  AppDatabase,
} from '../types';
export type { AppDatabase };
import { calculateGrade, rankAssessments } from '../utils/ranking';

const STORAGE_KEY = 'islamic_school_db_v1';

export const DEFAULT_SCHOOL_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="%231e3a8a"/>
      <stop offset="100%" stop-color="%230f172a"/>
    </linearGradient>
  </defs>
  <!-- Outer Crest -->
  <path d="M 80,10 C 130,10 145,45 145,85 C 145,120 110,145 80,155 C 50,145 15,120 15,85 C 15,45 30,10 80,10 Z" fill="none" stroke="%231e3a8a" stroke-width="4"/>
  <path d="M 80,18 C 122,18 137,48 137,85 C 137,115 106,138 80,147 C 54,138 23,115 23,85 C 23,48 38,18 80,18 Z" fill="%23f8fafc" stroke="%23047857" stroke-width="2"/>
  
  <!-- Minaret / Dome top -->
  <path d="M 80,26 L 86,38 L 74,38 Z" fill="%23047857"/>
  <circle cx="80" cy="24" r="3" fill="%23047857"/>
  <path d="M 70,42 Q 80,35 90,42 L 90,56 L 70,56 Z" fill="%231e3a8a"/>
  
  <!-- Open Holy Quran on Rehal (Stand) -->
  <!-- Left Page -->
  <path d="M 80,82 C 68,74 52,73 40,77 L 40,102 C 52,98 68,99 80,107 Z" fill="%23ffffff" stroke="%231e3a8a" stroke-width="2.5"/>
  <!-- Right Page -->
  <path d="M 80,82 C 92,74 108,73 120,77 L 120,102 C 108,98 92,99 80,107 Z" fill="%23ffffff" stroke="%231e3a8a" stroke-width="2.5"/>
  
  <!-- Quran Quranic lines -->
  <line x1="48" y1="83" x2="72" y2="86" stroke="%23047857" stroke-width="1.5"/>
  <line x1="46" y1="89" x2="72" y2="92" stroke="%23047857" stroke-width="1.5"/>
  <line x1="48" y1="95" x2="72" y2="98" stroke="%23047857" stroke-width="1.5"/>
  <line x1="88" y1="86" x2="112" y2="83" stroke="%23047857" stroke-width="1.5"/>
  <line x1="88" y1="92" x2="114" y2="89" stroke="%23047857" stroke-width="1.5"/>
  <line x1="88" y1="98" x2="112" y2="95" stroke="%23047857" stroke-width="1.5"/>
  
  <!-- Wooden Rehal Base -->
  <path d="M 50,118 L 80,95 L 110,118 L 102,123 L 80,106 L 58,123 Z" fill="%23854d0e"/>
  
  <!-- Olive Branch Laurel -->
  <path d="M 32,70 Q 28,100 50,126" fill="none" stroke="%23047857" stroke-width="2"/>
  <path d="M 128,70 Q 132,100 110,126" fill="none" stroke="%23047857" stroke-width="2"/>
</svg>`;

export const DEFAULT_SETTINGS: SchoolSettings = {
  schoolName: 'AT-TAHFIZU WAL ITQAN ISLAMIYYA, YOLA',
  arabicSchoolName: 'مدرسة التحفيظ والإتقان الإسلامية، يولا',
  motto: 'شعارنا: خيركم من تعلم القرآن وعلمه',
  address: 'Along Bypass Road, beside Bole Street Junction, Lamido Zubairu Way, Yola Town',
  telephone: '08033408522, 08058715879',
  email: 'attahfizul.itqan@gmail.com',
  currentSession: '2025/2026',
  currentTerm: '3rd Term',
  logoUrl: DEFAULT_SCHOOL_LOGO,
  ca1Max: 20,
  ca2Max: 20,
  examMax: 60,
  isOnboarded: true,
  lastBackupAt: new Date().toISOString(),
};

export const DEFAULT_CLASSES: ClassItem[] = [
  { id: 'cls-1', name: 'Nursery One', order: 1 },
  { id: 'cls-2', name: 'Nursery Two', order: 2 },
  { id: 'cls-3', name: 'Primary One', order: 3 },
  { id: 'cls-4', name: 'Primary Two', order: 4 },
  { id: 'cls-5', name: 'Primary Three', order: 5 },
  { id: 'cls-6', name: 'Primary Four', order: 6 },
  { id: 'cls-7', name: 'Primary Five', order: 7 },
  { id: 'cls-8', name: 'Primary Six', order: 8 },
  { id: 'cls-9', name: 'JSS One', order: 9 },
  { id: 'cls-10', name: 'JSS Two', order: 10 },
  { id: 'cls-11', name: 'JSS Three', order: 11 },
];

export const DEFAULT_SECTIONS: SectionItem[] = [
  { id: 'sec-1', name: 'A' },
  { id: 'sec-2', name: 'B' },
  { id: 'sec-3', name: 'C' },
  { id: 'sec-4', name: 'Islamiyya' },
  { id: 'sec-5', name: 'Arabic' },
  { id: 'sec-6', name: 'Tahfiz' },
];

export const DEFAULT_TERMS: string[] = ['1st Term', '2nd Term', '3rd Term'];

export const DEFAULT_SESSIONS: string[] = ['2024/2025', '2025/2026', '2026/2027'];

export const DEFAULT_SUBJECTS: SubjectItem[] = [
  { id: 'sub-1', name: "Qur'an", arabicName: 'القرآن الكريم', isActive: true },
  { id: 'sub-2', name: 'Tauhid', arabicName: 'التوحيد', isActive: true },
  { id: 'sub-3', name: "Qira'a", arabicName: 'القراءة', isActive: true },
  { id: 'sub-4', name: 'Hadith', arabicName: 'الحديث النبوي', isActive: true },
  { id: 'sub-5', name: 'Fiqh', arabicName: 'الفقه الإسلامي', isActive: true },
  { id: 'sub-6', name: 'Sirah', arabicName: 'السيرة النبوية', isActive: true },
  { id: 'sub-7', name: 'Arabic Language', arabicName: 'اللغة العربية', isActive: true },
  { id: 'sub-8', name: 'Islamic Studies', arabicName: 'الدراسات الإسلامية', isActive: true },
  { id: 'sub-9', name: 'English Studies', arabicName: 'اللغة الإنجليزية', isActive: true },
  { id: 'sub-10', name: 'Mathematics', arabicName: 'الرياضيات', isActive: true },
];

export const DEFAULT_GRADING_BOUNDARIES: GradeBoundary[] = [
  { min: 70, max: 100, grade: 'A', remark: 'Excellent' },
  { min: 60, max: 69.9, grade: 'B', remark: 'Very Good' },
  { min: 50, max: 59.9, grade: 'C', remark: 'Good' },
  { min: 45, max: 49.9, grade: 'D', remark: 'Pass' },
  { min: 40, max: 44.9, grade: 'E', remark: 'Fair' },
  { min: 0, max: 39.9, grade: 'F', remark: 'Fail' },
];

export const DEFAULT_PSYCHOMOTOR_ITEMS: PsychomotorItem[] = [
  { id: 'psy-1', name: 'Attendance' },
  { id: 'psy-2', name: 'Punctuality' },
  { id: 'psy-3', name: 'Neatness' },
  { id: 'psy-4', name: 'Attentiveness' },
  { id: 'psy-5', name: 'Honesty' },
  { id: 'psy-6', name: 'Helping others' },
  { id: 'psy-7', name: 'Politeness' },
];

// 22 realistic Nigerian/Islamic sample students
export const SAMPLE_STUDENTS: Student[] = [
  {
    id: 'stu-1',
    studentId: 'STU-2025-001',
    admissionNumber: 'ADM/2025/001',
    name: 'Muhammad Ahmad',
    className: 'Nursery One',
    section: 'A',
    gender: 'Male',
    dateOfBirth: '2021-04-12',
    parentName: 'Alhaji Ahmad Aliyu',
    parentPhone: '08031112233',
    address: 'Bole Street, Yola Town',
    admissionDate: '2024-09-10',
    status: 'Active',
    academicHistory: [
      {
        session: '2024/2025',
        term: '3rd Term',
        className: 'Nursery One',
        section: 'A',
        totalScore: 284,
        finalAverage: 94.6,
        position: '1st',
        remark: 'Promoted to Nursery Two',
      },
      {
        session: '2024/2025',
        term: '2nd Term',
        className: 'Nursery One',
        section: 'A',
        totalScore: 279,
        finalAverage: 93.0,
        position: '1st',
        remark: 'Excellent progress',
      },
    ],
  },
  {
    id: 'stu-2',
    studentId: 'STU-2025-002',
    admissionNumber: 'ADM/2025/002',
    name: 'Aisha Muhammad Ardo',
    className: 'Nursery One',
    section: 'A',
    gender: 'Female',
    dateOfBirth: '2021-06-25',
    parentName: 'Mallam Muhammad Ardo',
    parentPhone: '08023334455',
    address: 'Lamido Zubairu Way, Yola',
    admissionDate: '2024-09-10',
    status: 'Active',
    academicHistory: [
      {
        session: '2024/2025',
        term: '3rd Term',
        className: 'Nursery One',
        section: 'A',
        totalScore: 275,
        finalAverage: 91.7,
        position: '2nd',
        remark: 'Promoted to Nursery Two',
      },
    ],
  },
  {
    id: 'stu-3',
    studentId: 'STU-2025-003',
    admissionNumber: 'ADM/2025/003',
    name: 'Fatima Umar Aliyu',
    className: 'Nursery One',
    section: 'A',
    gender: 'Female',
    dateOfBirth: '2021-02-18',
    parentName: 'Dr. Umar Aliyu',
    parentPhone: '08034445566',
    address: 'Bok Estate, Yola',
    admissionDate: '2024-09-10',
    status: 'Active',
  },
  {
    id: 'stu-4',
    studentId: 'STU-2025-004',
    admissionNumber: 'ADM/2025/004',
    name: 'Usman Abubakar Bello',
    className: 'Nursery One',
    section: 'A',
    gender: 'Male',
    dateOfBirth: '2021-08-30',
    parentName: 'Abubakar Bello',
    parentPhone: '08065556677',
    address: 'Bypass Road, Yola',
    admissionDate: '2024-09-10',
    status: 'Active',
  },
  {
    id: 'stu-5',
    studentId: 'STU-2025-005',
    admissionNumber: 'ADM/2025/005',
    name: 'Khadija Aliyu Modibbo',
    className: 'Nursery One',
    section: 'A',
    gender: 'Female',
    dateOfBirth: '2021-05-14',
    parentName: 'Modibbo Aliyu',
    parentPhone: '08076667788',
    address: 'Damilu, Jimeta',
    admissionDate: '2024-09-10',
    status: 'Active',
  },
  {
    id: 'stu-6',
    studentId: 'STU-2025-006',
    admissionNumber: 'ADM/2025/006',
    name: 'Ibrahim Sani Lamido',
    className: 'Nursery One',
    section: 'A',
    gender: 'Male',
    dateOfBirth: '2021-09-05',
    parentName: 'Sani Lamido',
    parentPhone: '08037778899',
    address: 'Ajiya Ward, Yola',
    admissionDate: '2024-09-10',
    status: 'Active',
  },
  {
    id: 'stu-7',
    studentId: 'STU-2025-007',
    admissionNumber: 'ADM/2025/007',
    name: 'Maryam Bello Yola',
    className: 'Nursery One',
    section: 'A',
    gender: 'Female',
    dateOfBirth: '2021-11-20',
    parentName: 'Bello Yola',
    parentPhone: '08058889900',
    address: 'Doubeli, Jimeta',
    admissionDate: '2024-09-10',
    status: 'Active',
  },
  {
    id: 'stu-8',
    studentId: 'STU-2025-008',
    admissionNumber: 'ADM/2025/008',
    name: 'Abdullahi Garba Yola',
    className: 'Nursery One',
    section: 'B',
    gender: 'Male',
    dateOfBirth: '2021-03-10',
    parentName: 'Garba Yola',
    parentPhone: '08039990011',
    address: 'Mbamba, Yola',
    admissionDate: '2024-09-10',
    status: 'Active',
  },
  {
    id: 'stu-9',
    studentId: 'STU-2025-009',
    admissionNumber: 'ADM/2025/009',
    name: 'Zainab Dahiru Adamu',
    className: 'Nursery One',
    section: 'B',
    gender: 'Female',
    dateOfBirth: '2021-07-22',
    parentName: 'Dahiru Adamu',
    parentPhone: '08021113344',
    address: 'Karewa, Jimeta',
    admissionDate: '2024-09-10',
    status: 'Active',
  },
  {
    id: 'stu-10',
    studentId: 'STU-2025-010',
    admissionNumber: 'ADM/2025/010',
    name: 'Yusuf Mahmud Ribadu',
    className: 'Nursery One',
    section: 'B',
    gender: 'Male',
    dateOfBirth: '2021-01-15',
    parentName: 'Mahmud Ribadu',
    parentPhone: '08062224455',
    address: 'Police Barracks Road, Yola',
    admissionDate: '2024-09-10',
    status: 'Active',
  },
  {
    id: 'stu-11',
    studentId: 'STU-2025-011',
    admissionNumber: 'ADM/2025/011',
    name: 'Bilkisu Hassan Waziri',
    className: 'Nursery Two',
    section: 'A',
    gender: 'Female',
    dateOfBirth: '2020-04-19',
    parentName: 'Waziri Hassan',
    parentPhone: '08033335566',
    address: 'Bole Street, Yola',
    admissionDate: '2023-09-12',
    status: 'Active',
  },
  {
    id: 'stu-12',
    studentId: 'STU-2025-012',
    admissionNumber: 'ADM/2025/012',
    name: 'Umar Faruq Girei',
    className: 'Nursery Two',
    section: 'A',
    gender: 'Male',
    dateOfBirth: '2020-08-11',
    parentName: 'Faruq Girei',
    parentPhone: '08074446677',
    address: 'Girei Town',
    admissionDate: '2023-09-12',
    status: 'Active',
  },
  {
    id: 'stu-13',
    studentId: 'STU-2025-013',
    admissionNumber: 'ADM/2025/013',
    name: 'Amina Lawan Song',
    className: 'Nursery Two',
    section: 'A',
    gender: 'Female',
    dateOfBirth: '2020-10-03',
    parentName: 'Mallam Lawan Song',
    parentPhone: '08085557788',
    address: 'Shagari Lowcost, Yola',
    admissionDate: '2023-09-12',
    status: 'Active',
  },
  {
    id: 'stu-14',
    studentId: 'STU-2025-014',
    admissionNumber: 'ADM/2025/014',
    name: 'Mustapha Jibril Song',
    className: 'Primary One',
    section: 'A',
    gender: 'Male',
    dateOfBirth: '2019-06-15',
    parentName: 'Engr. Jibril Song',
    parentPhone: '08036668899',
    address: 'Fed. Housing Estate, Yola',
    admissionDate: '2022-09-15',
    status: 'Active',
  },
  {
    id: 'stu-15',
    studentId: 'STU-2025-015',
    admissionNumber: 'ADM/2025/015',
    name: 'Halima Zubairu Namtari',
    className: 'Primary One',
    section: 'A',
    gender: 'Female',
    dateOfBirth: '2019-03-28',
    parentName: 'Zubairu Namtari',
    parentPhone: '08097779900',
    address: 'Namtari, Yola South',
    admissionDate: '2022-09-15',
    status: 'Active',
  },
  {
    id: 'stu-16',
    studentId: 'STU-2025-016',
    admissionNumber: 'ADM/2025/016',
    name: 'Idris Babangida Mayo',
    className: 'Primary One',
    section: 'A',
    gender: 'Male',
    dateOfBirth: '2019-12-04',
    parentName: 'Babangida Mayo',
    parentPhone: '08028880011',
    address: 'Mayo Belwa Road, Yola',
    admissionDate: '2022-09-15',
    status: 'Active',
  },
  {
    id: 'stu-17',
    studentId: 'STU-2025-017',
    admissionNumber: 'ADM/2025/017',
    name: 'Ruqayya Salisu Fufore',
    className: 'Primary One',
    section: 'A',
    gender: 'Female',
    dateOfBirth: '2019-09-17',
    parentName: 'Salisu Fufore',
    parentPhone: '08031114455',
    address: 'Fufore Bypass, Yola',
    admissionDate: '2022-09-15',
    status: 'Active',
  },
  {
    id: 'stu-18',
    studentId: 'STU-2025-018',
    admissionNumber: 'ADM/2025/018',
    name: 'Hamza Mukhtar Jada',
    className: 'Primary One',
    section: 'B',
    gender: 'Male',
    dateOfBirth: '2019-05-20',
    parentName: 'Mukhtar Jada',
    parentPhone: '08052225566',
    address: '80 Housing Estate, Jimeta',
    admissionDate: '2022-09-15',
    status: 'Active',
  },
  {
    id: 'stu-19',
    studentId: 'STU-2025-019',
    admissionNumber: 'ADM/2025/019',
    name: 'Hafsat Yakubu Numan',
    className: 'Primary One',
    section: 'B',
    gender: 'Female',
    dateOfBirth: '2019-07-09',
    parentName: 'Yakubu Numan',
    parentPhone: '08063336677',
    address: 'Army Barracks Road, Yola',
    admissionDate: '2022-09-15',
    status: 'Active',
  },
  {
    id: 'stu-20',
    studentId: 'STU-2025-020',
    admissionNumber: 'ADM/2025/020',
    name: 'Ahmad Tijjani Gombi',
    className: 'Primary Two',
    section: 'A',
    gender: 'Male',
    dateOfBirth: '2018-02-14',
    parentName: 'Tijjani Gombi',
    parentPhone: '08074447788',
    address: 'Karewa GRA, Jimeta',
    admissionDate: '2021-09-10',
    status: 'Active',
  },
  {
    id: 'stu-21',
    studentId: 'STU-2025-021',
    admissionNumber: 'ADM/2025/021',
    name: 'Safiya Haruna Mubi',
    className: 'Primary Two',
    section: 'A',
    gender: 'Female',
    dateOfBirth: '2018-10-31',
    parentName: 'Haruna Mubi',
    parentPhone: '08085558899',
    address: 'Dougirei, Jimeta',
    admissionDate: '2021-09-10',
    status: 'Active',
  },
  {
    id: 'stu-22',
    studentId: 'STU-2025-022',
    admissionNumber: 'ADM/2025/022',
    name: 'Bello Mohammed Toungo',
    className: 'Primary Three',
    section: 'A',
    gender: 'Male',
    dateOfBirth: '2017-08-08',
    parentName: 'Mohammed Toungo',
    parentPhone: '08096669900',
    address: 'Lamido Palace Area, Yola',
    admissionDate: '2020-09-14',
    status: 'Active',
  },
];

// Helper to generate sample assessment scores matching the user's sample sheet
function createSampleAssessment(
  studentId: string,
  className: string,
  section: string,
  scores: Array<{ subjectId: string; subjectName: string; arabicName: string; ca1: number; ca2: number; exam: number }>,
  daysOpened: number,
  daysPresent: number,
  formTeacherComment: string,
  promotionRemark: string,
  psychomotorMap: Record<string, string>
): AssessmentRecord {
  const subjectScores = scores.map(sc => {
    const total = sc.ca1 + sc.ca2 + sc.exam;
    const { grade } = calculateGrade(total, DEFAULT_GRADING_BOUNDARIES);
    return {
      ...sc,
      total,
      grade,
      position: '-',
    };
  });

  const totalScore = subjectScores.reduce((sum, sc) => sum + sc.total, 0);
  const finalAverage = subjectScores.length > 0 ? Math.round((totalScore / subjectScores.length) * 10) / 10 : 0;
  const daysAbsent = Math.max(0, daysOpened - daysPresent);

  return {
    id: `asm-${studentId}-2025-2026-3rd`,
    studentId,
    academicSession: '2025/2026',
    term: '3rd Term',
    className,
    section,
    subjectScores,
    totalScore,
    finalAverage,
    daysOpened,
    daysPresent,
    daysAbsent,
    psychomotorRatings: psychomotorMap,
    formTeacherName: 'Aisha Muhammad Ardo',
    formTeacherComment,
    promotionRemark,
    schoolCloses: '24th Dhul Hijjah 1447 / 10th June 2026',
    nextTermBegins: '04th Muharram 1448 / 20th July 2026',
    nextTermFees: '₦ 16,000',
    updatedAt: new Date().toISOString(),
  };
}

export const SAMPLE_ASSESSMENTS: AssessmentRecord[] = [
  // Student 1: Muhammad Ahmad (Top student in Nursery One A)
  createSampleAssessment(
    'STU-2025-001',
    'Nursery One',
    'A',
    [
      { subjectId: 'sub-1', subjectName: "Qur'an", arabicName: 'القرآن الكريم', ca1: 19, ca2: 19, exam: 58 },
      { subjectId: 'sub-2', subjectName: 'Tauhid', arabicName: 'التوحيد', ca1: 18, ca2: 19, exam: 56 },
      { subjectId: 'sub-3', subjectName: "Qira'a", arabicName: 'القراءة', ca1: 19, ca2: 18, exam: 55 },
    ],
    90,
    88,
    'Outstanding recitation and exemplary Islamic conduct. Keep it up!',
    'PASS & PROMOTED',
    {
      'psy-1': 'A',
      'psy-2': 'A',
      'psy-3': 'A',
      'psy-4': 'A',
      'psy-5': 'A',
      'psy-6': 'A',
      'psy-7': 'A',
    }
  ),
  // Student 2: Aisha Muhammad Ardo
  createSampleAssessment(
    'STU-2025-002',
    'Nursery One',
    'A',
    [
      { subjectId: 'sub-1', subjectName: "Qur'an", arabicName: 'القرآن الكريم', ca1: 18, ca2: 17, exam: 54 },
      { subjectId: 'sub-2', subjectName: 'Tauhid', arabicName: 'التوحيد', ca1: 17, ca2: 18, exam: 52 },
      { subjectId: 'sub-3', subjectName: "Qira'a", arabicName: 'القراءة', ca1: 18, ca2: 17, exam: 53 },
    ],
    90,
    89,
    'A very intelligent and disciplined student. Well done.',
    'PASS & PROMOTED',
    {
      'psy-1': 'A',
      'psy-2': 'A',
      'psy-3': 'A',
      'psy-4': 'A',
      'psy-5': 'A',
      'psy-6': 'B',
      'psy-7': 'A',
    }
  ),
  // Student 3: Fatima Umar Aliyu
  createSampleAssessment(
    'STU-2025-003',
    'Nursery One',
    'A',
    [
      { subjectId: 'sub-1', subjectName: "Qur'an", arabicName: 'القرآن الكريم', ca1: 16, ca2: 16, exam: 50 },
      { subjectId: 'sub-2', subjectName: 'Tauhid', arabicName: 'التوحيد', ca1: 15, ca2: 16, exam: 48 },
      { subjectId: 'sub-3', subjectName: "Qira'a", arabicName: 'القراءة', ca1: 17, ca2: 15, exam: 49 },
    ],
    90,
    85,
    'Good academic progress. More effort needed in Tauhid memorization.',
    'PASS & PROMOTED',
    {
      'psy-1': 'B',
      'psy-2': 'A',
      'psy-3': 'A',
      'psy-4': 'B',
      'psy-5': 'A',
      'psy-6': 'A',
      'psy-7': 'A',
    }
  ),
  // Student 4: Usman Abubakar Bello
  createSampleAssessment(
    'STU-2025-004',
    'Nursery One',
    'A',
    [
      { subjectId: 'sub-1', subjectName: "Qur'an", arabicName: 'القرآن الكريم', ca1: 14, ca2: 15, exam: 44 },
      { subjectId: 'sub-2', subjectName: 'Tauhid', arabicName: 'التوحيد', ca1: 15, ca2: 14, exam: 42 },
      { subjectId: 'sub-3', subjectName: "Qira'a", arabicName: 'القراءة', ca1: 13, ca2: 14, exam: 40 },
    ],
    90,
    80,
    'Satisfactory performance. Advised to revise Qiraa daily at home.',
    'PASS & PROMOTED',
    {
      'psy-1': 'B',
      'psy-2': 'B',
      'psy-3': 'B',
      'psy-4': 'C',
      'psy-5': 'A',
      'psy-6': 'B',
      'psy-7': 'B',
    }
  ),
  // Student 5: Khadija Aliyu Modibbo
  createSampleAssessment(
    'STU-2025-005',
    'Nursery One',
    'A',
    [
      { subjectId: 'sub-1', subjectName: "Qur'an", arabicName: 'القرآن الكريم', ca1: 12, ca2: 11, exam: 35 },
      { subjectId: 'sub-2', subjectName: 'Tauhid', arabicName: 'التوحيد', ca1: 10, ca2: 12, exam: 34 },
      { subjectId: 'sub-3', subjectName: "Qira'a", arabicName: 'القراءة', ca1: 11, ca2: 10, exam: 32 },
    ],
    90,
    72,
    'Needs extra parental guidance and regular attendance to improve.',
    'PASS & REPEAT',
    {
      'psy-1': 'C',
      'psy-2': 'C',
      'psy-3': 'B',
      'psy-4': 'C',
      'psy-5': 'B',
      'psy-6': 'B',
      'psy-7': 'B',
    }
  ),
  // Student 6: Ibrahim Sani Lamido
  createSampleAssessment(
    'STU-2025-006',
    'Nursery One',
    'A',
    [
      { subjectId: 'sub-1', subjectName: "Qur'an", arabicName: 'القرآن الكريم', ca1: 17, ca2: 18, exam: 52 },
      { subjectId: 'sub-2', subjectName: 'Tauhid', arabicName: 'التوحيد', ca1: 16, ca2: 17, exam: 50 },
      { subjectId: 'sub-3', subjectName: "Qira'a", arabicName: 'القراءة', ca1: 16, ca2: 16, exam: 51 },
    ],
    90,
    87,
    'Good result. Shows commendable dedication to memorization.',
    'PASS & PROMOTED',
    {
      'psy-1': 'A',
      'psy-2': 'B',
      'psy-3': 'A',
      'psy-4': 'A',
      'psy-5': 'A',
      'psy-6': 'A',
      'psy-7': 'A',
    }
  ),
  // Student 7: Maryam Bello Yola
  createSampleAssessment(
    'STU-2025-007',
    'Nursery One',
    'A',
    [
      { subjectId: 'sub-1', subjectName: "Qur'an", arabicName: 'القرآن الكريم', ca1: 15, ca2: 16, exam: 46 },
      { subjectId: 'sub-2', subjectName: 'Tauhid', arabicName: 'التوحيد', ca1: 14, ca2: 15, exam: 45 },
      { subjectId: 'sub-3', subjectName: "Qira'a", arabicName: 'القراءة', ca1: 15, ca2: 14, exam: 44 },
    ],
    90,
    84,
    'A pleasant child with steady academic improvement.',
    'PASS & PROMOTED',
    {
      'psy-1': 'B',
      'psy-2': 'A',
      'psy-3': 'A',
      'psy-4': 'B',
      'psy-5': 'A',
      'psy-6': 'A',
      'psy-7': 'A',
    }
  ),
];

export function getDefaultDatabase(): AppDatabase {
  // Compute initial ranks for sample assessments
  const rankedSamples = rankAssessments(SAMPLE_ASSESSMENTS);

  return {
    settings: { ...DEFAULT_SETTINGS },
    classes: [...DEFAULT_CLASSES],
    sections: [...DEFAULT_SECTIONS],
    subjects: [...DEFAULT_SUBJECTS],
    terms: [...DEFAULT_TERMS],
    sessions: [...DEFAULT_SESSIONS],
    gradingBoundaries: [...DEFAULT_GRADING_BOUNDARIES],
    psychomotorItems: [...DEFAULT_PSYCHOMOTOR_ITEMS],
    students: [...SAMPLE_STUDENTS],
    assessments: rankedSamples,
    attendance: SAMPLE_ASSESSMENTS.map(a => ({
      id: `att-${a.studentId}-${a.academicSession.replace('/', '-')}-${a.term.replace(/\s+/g, '-')}`,
      studentId: a.studentId,
      academicSession: a.academicSession,
      term: a.term,
      className: a.className,
      section: a.section,
      daysOpened: a.daysOpened,
      daysPresent: a.daysPresent,
      daysAbsent: a.daysAbsent,
      updatedAt: a.updatedAt,
    })),
  };
}

export function loadDatabase(): AppDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getDefaultDatabase();
      saveDatabase(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as AppDatabase;

    // Safety checks & fallbacks
    if (!parsed.settings) parsed.settings = { ...DEFAULT_SETTINGS };
    if (!parsed.classes || parsed.classes.length === 0) parsed.classes = [...DEFAULT_CLASSES];
    if (!parsed.sections || parsed.sections.length === 0) parsed.sections = [...DEFAULT_SECTIONS];
    if (!parsed.subjects || parsed.subjects.length === 0) parsed.subjects = [...DEFAULT_SUBJECTS];
    if (!parsed.terms || parsed.terms.length === 0) parsed.terms = [...DEFAULT_TERMS];
    if (!parsed.sessions || parsed.sessions.length === 0) parsed.sessions = [...DEFAULT_SESSIONS];
    if (!parsed.gradingBoundaries || parsed.gradingBoundaries.length === 0) parsed.gradingBoundaries = [...DEFAULT_GRADING_BOUNDARIES];
    if (!parsed.psychomotorItems || parsed.psychomotorItems.length === 0) parsed.psychomotorItems = [...DEFAULT_PSYCHOMOTOR_ITEMS];
    if (!parsed.students) parsed.students = [...SAMPLE_STUDENTS];
    if (!parsed.assessments) parsed.assessments = rankAssessments(SAMPLE_ASSESSMENTS);
    if (!parsed.attendance) parsed.attendance = [];

    return parsed;
  } catch (err) {
    console.error('Failed to load database from localStorage, initializing defaults:', err);
    const initial = getDefaultDatabase();
    saveDatabase(initial);
    return initial;
  }
}

export function saveDatabase(db: AppDatabase): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.error('Failed to save database to localStorage:', err);
  }
}

export function resetDatabaseToDefault(): AppDatabase {
  const initial = getDefaultDatabase();
  saveDatabase(initial);
  return initial;
}
