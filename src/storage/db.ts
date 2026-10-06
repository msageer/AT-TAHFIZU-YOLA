import {
  SchoolSettings,
  ClassItem,
  SectionItem,
  SubjectItem,
  GradeBoundary,
  PsychomotorItem,
  Student,
  AssessmentRecord,
  AttendanceRecord,
  UserAccount,
  AuditLogEntry,
  AppDatabase,
} from '../types';
export type { AppDatabase };
import { calculateGrade, rankAssessments } from '../utils/ranking';

const STORAGE_KEY = 'islamic_school_db_v2';
const BACKUP_STORAGE_KEY = 'islamic_school_db_backup_snapshot';
const LEGACY_STORAGE_KEYS = [
  'islamic_school_db_v2',
  'islamic_school_db_backup_snapshot',
  'islamic_school_db',
  'islamic_school_db_v1',
  'islamic_school_database',
  'islamic_school_management_db',
];
const AUTH_SESSION_KEY = 'islamic_school_auth_session_v2';

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

export const DEFAULT_SUPER_ADMIN: UserAccount = {
  id: 'usr-superadmin-alamin',
  email: 'alaminkaigama@gmail.com',
  username: 'alaminkaigama',
  fullName: 'Alamin Kaigama',
  phone: '07066979027',
  passwordHash: '123456',
  role: 'super_admin',
  schoolId: 'school-main',
  status: 'active',
  createdAt: new Date().toISOString(),
};

export const DEFAULT_TEACHER_ACCOUNT: UserAccount = {
  id: 'usr-teacher-1',
  email: 'teacher@school.edu',
  username: 'teacher',
  fullName: 'Ustaza Aisha Muhammad Ardo',
  phone: '08058715879',
  passwordHash: 'teacher123',
  role: 'teacher',
  schoolId: 'school-main',
  status: 'active',
  assignedClass: 'Primary One',
  assignedSection: 'A',
  assignedSession: '2026/2027',
  createdAt: new Date().toISOString(),
};

export const DEFAULT_STAFF_ACCOUNT: UserAccount = {
  id: 'usr-staff-1',
  email: 'staff@school.edu',
  username: 'staff',
  fullName: 'Ibrahim Sani (Exam Officer)',
  phone: '08021112233',
  passwordHash: 'staff123',
  role: 'staff',
  schoolId: 'school-main',
  status: 'active',
  permissions: ['students', 'assessment', 'reports', 'class-summary', 'attendance'],
  createdAt: new Date().toISOString(),
};

/**
 * Returns clean production database with onboarding pre-completed and default super admin ready.
 */
export function getEmptyDatabase(): AppDatabase {
  return {
    schoolId: 'school-main',
    settings: {
      schoolId: 'school-main',
      schoolName: 'AT-TAHFIZU WAL ITQAN ISLAMIYYA',
      arabicSchoolName: 'مدرسة التحفيظ والإتقان الإسلامية',
      motto: 'شعارنا: خيركم من تعلم القرآن وعلمه',
      address: 'Along Bypass Road, Lamido Zubairu Way, Yola',
      telephone: '08033408522, 08058715879',
      email: 'alaminkaigama@gmail.com',
      website: '',
      currentSession: '2026/2027',
      currentTerm: '1st Term',
      logoUrl: '',
      ca1Max: 20,
      ca2Max: 20,
      examMax: 60,
      isSetupComplete: true, // Initial onboarding done once!
      useSections: true,
      lastBackupAt: undefined,
    },
    classes: [
      { id: 'cls-1', name: 'Nursery One', order: 1, schoolId: 'school-main' },
      { id: 'cls-2', name: 'Nursery Two', order: 2, schoolId: 'school-main' },
      { id: 'cls-3', name: 'Primary One', order: 3, schoolId: 'school-main' },
      { id: 'cls-4', name: 'Primary Two', order: 4, schoolId: 'school-main' },
    ],
    sections: [
      { id: 'sec-1', name: 'A', schoolId: 'school-main' },
      { id: 'sec-2', name: 'B', schoolId: 'school-main' },
    ],
    subjects: [
      { id: 'sub-1', name: "Qur'an", arabicName: 'القرآن الكريم', isActive: true, schoolId: 'school-main' },
      { id: 'sub-2', name: 'Tauhid', arabicName: 'التوحيد', isActive: true, schoolId: 'school-main' },
      { id: 'sub-3', name: "Qira'a", arabicName: 'القراءة', isActive: true, schoolId: 'school-main' },
      { id: 'sub-4', name: 'Hadith', arabicName: 'الحديث النبوي', isActive: true, schoolId: 'school-main' },
      { id: 'sub-5', name: 'Fiqh', arabicName: 'الفقه الإسلامي', isActive: true, schoolId: 'school-main' },
      { id: 'sub-6', name: 'Arabic Language', arabicName: 'اللغة العربية', isActive: true, schoolId: 'school-main' },
      { id: 'sub-7', name: 'English Studies', arabicName: 'اللغة الإنجليزية', isActive: true, schoolId: 'school-main' },
      { id: 'sub-8', name: 'Mathematics', arabicName: 'الرياضيات', isActive: true, schoolId: 'school-main' },
    ],
    terms: ['1st Term', '2nd Term', '3rd Term'],
    sessions: ['2025/2026', '2026/2027', '2027/2028'],
    gradingBoundaries: [...DEFAULT_GRADING_BOUNDARIES],
    psychomotorItems: [...DEFAULT_PSYCHOMOTOR_ITEMS],
    students: [],
    assessments: [],
    attendance: [],
    users: [DEFAULT_SUPER_ADMIN],
    auditLogs: [],
  };
}

/**
 * Loads database from local storage, or initializes clean empty database
 * STRICT NON-TAMPERING: Never overrides existing student, class, assessment, or settings data.
 * Checks primary key, backup snapshot, and legacy keys across all deployments.
 */
export function loadDatabase(): AppDatabase {
  try {
    let raw: string | null = null;
    // 1. Check primary storage key
    raw = localStorage.getItem(STORAGE_KEY);

    // 2. Check backup and legacy deployment keys if primary is empty
    if (!raw) {
      for (const key of LEGACY_STORAGE_KEYS) {
        const val = localStorage.getItem(key);
        if (val) {
          try {
            const testParsed = JSON.parse(val);
            if (testParsed && typeof testParsed === 'object') {
              raw = val;
              break;
            }
          } catch {
            // ignore invalid JSON
          }
        }
      }
    }

    if (!raw) {
      const initial = getEmptyDatabase();
      saveDatabase(initial);
      return initial;
    }

    const parsed = JSON.parse(raw) as AppDatabase;

    // Safety checks & fallbacks - NEVER overwrite existing user data
    if (!parsed.schoolId) parsed.schoolId = 'school-main';

    // Settings: merge non-destructively so existing school details are 100% preserved
    const defaultSettings = getEmptyDatabase().settings;
    parsed.settings = {
      ...defaultSettings,
      ...(parsed.settings || {}),
      isSetupComplete: true, // Keep marked complete
    };

    // Classes, Sections, Subjects: preserve existing configurations
    if (!parsed.classes || parsed.classes.length === 0) {
      parsed.classes = getEmptyDatabase().classes;
    }
    if (!parsed.sections || parsed.sections.length === 0) {
      parsed.sections = getEmptyDatabase().sections;
    }
    if (!parsed.subjects || parsed.subjects.length === 0) {
      parsed.subjects = getEmptyDatabase().subjects;
    }
    if (!parsed.terms || parsed.terms.length === 0) {
      parsed.terms = ['1st Term', '2nd Term', '3rd Term'];
    }
    if (!parsed.sessions || parsed.sessions.length === 0) {
      parsed.sessions = ['2025/2026', '2026/2027', '2027/2028'];
    }
    if (!parsed.gradingBoundaries || parsed.gradingBoundaries.length === 0) {
      parsed.gradingBoundaries = [...DEFAULT_GRADING_BOUNDARIES];
    }
    if (!parsed.psychomotorItems || parsed.psychomotorItems.length === 0) {
      parsed.psychomotorItems = [...DEFAULT_PSYCHOMOTOR_ITEMS];
    }

    // STRICT NON-TAMPERING: Preserve all existing student records
    if (!parsed.students || !Array.isArray(parsed.students)) {
      parsed.students = [];
    }

    // Secondary recovery check: if parsed has no students, check backup snapshot
    if (parsed.students.length === 0) {
      try {
        const backupRaw = localStorage.getItem(BACKUP_STORAGE_KEY);
        if (backupRaw) {
          const backupParsed = JSON.parse(backupRaw) as AppDatabase;
          if (backupParsed?.students && backupParsed.students.length > 0) {
            parsed.students = backupParsed.students;
            if (backupParsed.assessments && backupParsed.assessments.length > 0) {
              parsed.assessments = backupParsed.assessments;
            }
            if (backupParsed.attendance && backupParsed.attendance.length > 0) {
              parsed.attendance = backupParsed.attendance;
            }
          }
        }
      } catch {
        // ignore backup recovery errors
      }
    }

    // STRICT NON-TAMPERING: Preserve all assessment records
    if (!parsed.assessments || !Array.isArray(parsed.assessments)) {
      parsed.assessments = [];
    }

    // STRICT NON-TAMPERING: Preserve all attendance records
    if (!parsed.attendance || !Array.isArray(parsed.attendance)) {
      parsed.attendance = [];
    }

    // User Accounts: Purge only obsolete test admin credentials while preserving all user-created staff & teachers
    const cleanedUsers = (parsed.users || []).filter(u => {
      const emailLower = (u.email || '').toLowerCase().trim();
      const usernameLower = (u.username || '').toLowerCase().trim();
      if (emailLower === 'admin@school.edu' || emailLower === 'admin@attahfiz.edu') return false;
      if (usernameLower === 'superadmin' && emailLower !== 'alaminkaigama@gmail.com') return false;
      if (u.id === 'usr-admin') return false;
      if (u.role === 'super_admin' && emailLower !== 'alaminkaigama@gmail.com') return false;
      return true;
    });

    // Ensure Alamin Kaigama (alaminkaigama@gmail.com) is Super Admin with credentials preserved
    const alaminIndex = cleanedUsers.findIndex(u => u.email.toLowerCase().trim() === 'alaminkaigama@gmail.com');
    if (alaminIndex >= 0) {
      cleanedUsers[alaminIndex] = {
        ...cleanedUsers[alaminIndex],
        id: cleanedUsers[alaminIndex].id || 'usr-superadmin-alamin',
        email: 'alaminkaigama@gmail.com',
        username: cleanedUsers[alaminIndex].username || 'alaminkaigama',
        fullName: cleanedUsers[alaminIndex].fullName || 'Alamin Kaigama',
        passwordHash: cleanedUsers[alaminIndex].passwordHash || '123456',
        role: 'super_admin',
        status: 'active',
      };
    } else {
      cleanedUsers.unshift(DEFAULT_SUPER_ADMIN);
    }

    parsed.users = cleanedUsers;
    if (!parsed.auditLogs) parsed.auditLogs = [];

    // Save migrated and validated state back to storage
    saveDatabase(parsed);
    return parsed;
  } catch (err) {
    console.error('Failed to load database from localStorage, checking backup recovery:', err);
    try {
      const backupRaw = localStorage.getItem(BACKUP_STORAGE_KEY);
      if (backupRaw) {
        return JSON.parse(backupRaw) as AppDatabase;
      }
    } catch {
      // ignore
    }
    const initial = getEmptyDatabase();
    saveDatabase(initial);
    return initial;
  }
}

export function saveDatabase(db: AppDatabase): void {
  try {
    const serialized = JSON.stringify(db);
    localStorage.setItem(STORAGE_KEY, serialized);
    // Continuous safety backup snapshot to prevent any data loss across git deployments
    localStorage.setItem(BACKUP_STORAGE_KEY, serialized);
  } catch (err) {
    console.error('Failed to save database to localStorage:', err);
  }
}

export function resetDatabaseToEmpty(): AppDatabase {
  const empty = getEmptyDatabase();
  saveDatabase(empty);
  return empty;
}

/**
 * Audit Logger
 */
export function addAuditLog(
  db: AppDatabase,
  user: UserAccount,
  action: string,
  details: string
): AppDatabase {
  const entry: AuditLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    schoolId: db.schoolId || 'school-main',
    userId: user.id,
    userName: user.fullName || user.email,
    userRole: user.role,
    action,
    details,
    timestamp: new Date().toISOString(),
  };

  const updatedLogs = [entry, ...(db.auditLogs || [])].slice(0, 500); // keep up to 500 logs
  const updatedDb = { ...db, auditLogs: updatedLogs };
  saveDatabase(updatedDb);
  return updatedDb;
}

/**
 * Authentication Session Management
 */
export function getCurrentSessionUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as UserAccount;
    const emailLower = (user.email || '').toLowerCase().trim();
    if (
      emailLower === 'admin@school.edu' ||
      emailLower === 'admin@attahfiz.edu' ||
      (user.role === 'super_admin' && emailLower !== 'alaminkaigama@gmail.com')
    ) {
      localStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export function setCurrentSessionUser(user: UserAccount | null): void {
  try {
    if (user) {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_SESSION_KEY);
    }
  } catch (err) {
    console.error('Failed to save auth session:', err);
  }
}

/**
 * =========================================================================
 * OPTIONAL DEVELOPMENT SEED DATA (Only run when explicitly requested by user)
 * Never loaded automatically into production!
 * =========================================================================
 */
export const SAMPLE_SCHOOL_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <path d="M 80,10 C 130,10 145,45 145,85 C 145,120 110,145 80,155 C 50,145 15,120 15,85 C 15,45 30,10 80,10 Z" fill="none" stroke="%231e3a8a" stroke-width="4"/>
  <path d="M 80,18 C 122,18 137,48 137,85 C 137,115 106,138 80,147 C 54,138 23,115 23,85 C 23,48 38,18 80,18 Z" fill="%23f8fafc" stroke="%23047857" stroke-width="2"/>
  <path d="M 80,26 L 86,38 L 74,38 Z" fill="%23047857"/>
  <circle cx="80" cy="24" r="3" fill="%23047857"/>
  <path d="M 70,42 Q 80,35 90,42 L 90,56 L 70,56 Z" fill="%231e3a8a"/>
  <path d="M 80,82 C 68,74 52,73 40,77 L 40,102 C 52,98 68,99 80,107 Z" fill="%23ffffff" stroke="%231e3a8a" stroke-width="2.5"/>
  <path d="M 80,82 C 92,74 108,73 120,77 L 120,102 C 108,98 92,99 80,107 Z" fill="%23ffffff" stroke="%231e3a8a" stroke-width="2.5"/>
  <path d="M 50,118 L 80,95 L 110,118 L 102,123 L 80,106 L 58,123 Z" fill="%23854d0e"/>
</svg>`;

export function loadDemoDevelopmentDatabase(): AppDatabase {
  const demoUsers: UserAccount[] = [
    {
      id: 'usr-superadmin-alamin',
      email: 'alaminkaigama@gmail.com',
      username: 'alaminkaigama',
      fullName: 'Alamin Kaigama',
      phone: '07066979027',
      passwordHash: '123456',
      role: 'super_admin',
      schoolId: 'school-main',
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr-teacher-1',
      email: 'teacher@attahfiz.edu',
      username: 'aisha.ardo',
      fullName: 'Ustaza Aisha Muhammad Ardo',
      phone: '08058715879',
      passwordHash: 'teacher123',
      role: 'teacher',
      schoolId: 'school-main',
      status: 'active',
      assignedClass: 'Primary One',
      assignedSection: 'A',
      assignedSession: '2026/2027',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr-staff-1',
      email: 'exams@attahfiz.edu',
      username: 'exams.officer',
      fullName: 'Ibrahim Sani (Exam & Records Officer)',
      phone: '08021112233',
      passwordHash: 'staff123',
      role: 'staff',
      schoolId: 'school-main',
      status: 'active',
      permissions: ['students', 'assessment', 'reports', 'class-summary', 'attendance'],
      createdAt: new Date().toISOString(),
    },
  ];

  const demoClasses: ClassItem[] = [
    { id: 'cls-1', name: 'Nursery One', order: 1, schoolId: 'school-main' },
    { id: 'cls-2', name: 'Nursery Two', order: 2, schoolId: 'school-main' },
    { id: 'cls-3', name: 'Primary One', order: 3, schoolId: 'school-main' },
    { id: 'cls-4', name: 'Primary Two', order: 4, schoolId: 'school-main' },
    { id: 'cls-5', name: 'Primary Three', order: 5, schoolId: 'school-main' },
    { id: 'cls-6', name: 'Tahfiz Level 1', order: 6, schoolId: 'school-main' },
  ];

  const demoSections: SectionItem[] = [
    { id: 'sec-1', name: 'A', schoolId: 'school-main' },
    { id: 'sec-2', name: 'B', schoolId: 'school-main' },
    { id: 'sec-3', name: 'Islamiyya', schoolId: 'school-main' },
  ];

  const demoSubjects: SubjectItem[] = [
    { id: 'sub-1', name: "Qur'an", arabicName: 'القرآن الكريم', isActive: true, schoolId: 'school-main' },
    { id: 'sub-2', name: 'Tauhid', arabicName: 'التوحيد', isActive: true, schoolId: 'school-main' },
    { id: 'sub-3', name: "Qira'a", arabicName: 'القراءة', isActive: true, schoolId: 'school-main' },
    { id: 'sub-4', name: 'Hadith', arabicName: 'الحديث النبوي', isActive: true, schoolId: 'school-main' },
    { id: 'sub-5', name: 'Fiqh', arabicName: 'الفقه الإسلامي', isActive: true, schoolId: 'school-main' },
    { id: 'sub-6', name: 'Arabic Language', arabicName: 'اللغة العربية', isActive: true, schoolId: 'school-main' },
    { id: 'sub-7', name: 'English Studies', arabicName: 'اللغة الإنجليزية', isActive: true, schoolId: 'school-main' },
    { id: 'sub-8', name: 'Mathematics', arabicName: 'الرياضيات', isActive: true, schoolId: 'school-main' },
  ];

  const demoStudents: Student[] = [
    {
      id: 'stu-1',
      schoolId: 'school-main',
      studentId: 'STU-2026-001',
      admissionNumber: 'ADM/2026/001',
      name: 'Muhammad Ahmad',
      className: 'Primary One',
      section: 'A',
      gender: 'Male',
      dateOfBirth: '2020-04-12',
      parentName: 'Alhaji Ahmad Aliyu',
      parentPhone: '08031112233',
      address: 'Bole Street, Yola Town',
      admissionDate: '2024-09-10',
      status: 'Active',
      academicHistory: [
        {
          session: '2025/2026',
          term: '3rd Term',
          className: 'Nursery Two',
          section: 'A',
          totalScore: 284,
          finalAverage: 94.6,
          position: '1st',
          remark: 'Promoted to Primary One',
        },
      ],
    },
    {
      id: 'stu-2',
      schoolId: 'school-main',
      studentId: 'STU-2026-002',
      admissionNumber: 'ADM/2026/002',
      name: 'Aisha Muhammad Ardo',
      className: 'Primary One',
      section: 'A',
      gender: 'Female',
      dateOfBirth: '2020-06-25',
      parentName: 'Mallam Muhammad Ardo',
      parentPhone: '08023334455',
      address: 'Lamido Zubairu Way, Yola',
      admissionDate: '2024-09-10',
      status: 'Active',
    },
    {
      id: 'stu-3',
      schoolId: 'school-main',
      studentId: 'STU-2026-003',
      admissionNumber: 'ADM/2026/003',
      name: 'Fatima Umar Aliyu',
      className: 'Primary One',
      section: 'A',
      gender: 'Female',
      dateOfBirth: '2020-02-18',
      parentName: 'Dr. Umar Aliyu',
      parentPhone: '08034445566',
      address: 'Bok Estate, Yola',
      admissionDate: '2024-09-10',
      status: 'Active',
    },
    {
      id: 'stu-4',
      schoolId: 'school-main',
      studentId: 'STU-2026-004',
      admissionNumber: 'ADM/2026/004',
      name: 'Usman Abubakar Bello',
      className: 'Primary One',
      section: 'A',
      gender: 'Male',
      dateOfBirth: '2020-08-30',
      parentName: 'Abubakar Bello',
      parentPhone: '08065556677',
      address: 'Bypass Road, Yola',
      admissionDate: '2024-09-10',
      status: 'Active',
    },
    {
      id: 'stu-5',
      schoolId: 'school-main',
      studentId: 'STU-2026-005',
      admissionNumber: 'ADM/2026/005',
      name: 'Khadija Aliyu Modibbo',
      className: 'Primary One',
      section: 'A',
      gender: 'Female',
      dateOfBirth: '2020-05-14',
      parentName: 'Modibbo Aliyu',
      parentPhone: '08076667788',
      address: 'Damilu, Jimeta',
      admissionDate: '2024-09-10',
      status: 'Active',
    },
  ];

  const demoAssessments: AssessmentRecord[] = [
    {
      id: 'asm-STU-2026-001-2026-2027-1st',
      schoolId: 'school-main',
      studentId: 'STU-2026-001',
      academicSession: '2026/2027',
      term: '1st Term',
      className: 'Primary One',
      section: 'A',
      subjectScores: [
        { subjectId: 'sub-1', subjectName: "Qur'an", arabicName: 'القرآن الكريم', ca1: 19, ca2: 19, exam: 58, total: 96, grade: 'A', position: '1st' },
        { subjectId: 'sub-2', subjectName: 'Tauhid', arabicName: 'التوحيد', ca1: 18, ca2: 19, exam: 56, total: 93, grade: 'A', position: '1st' },
        { subjectId: 'sub-3', subjectName: "Qira'a", arabicName: 'القراءة', ca1: 19, ca2: 18, exam: 55, total: 92, grade: 'A', position: '1st' },
      ],
      totalScore: 281,
      finalAverage: 93.7,
      finalPosition: '1st',
      daysOpened: 90,
      daysPresent: 88,
      daysAbsent: 2,
      psychomotorRatings: { 'psy-1': 'A', 'psy-2': 'A', 'psy-3': 'A', 'psy-4': 'A', 'psy-5': 'A', 'psy-6': 'A', 'psy-7': 'A' },
      formTeacherName: 'Ustaza Aisha Muhammad Ardo',
      formTeacherComment: 'Outstanding Quranic recitation and Islamic discipline.',
      promotionRemark: 'PASS & PROMOTED',
      schoolCloses: '24th Dhul Hijjah 1447 / 10th June 2026',
      nextTermBegins: '04th Muharram 1448 / 20th July 2026',
      nextTermFees: '₦ 16,000',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'asm-STU-2026-002-2026-2027-1st',
      schoolId: 'school-main',
      studentId: 'STU-2026-002',
      academicSession: '2026/2027',
      term: '1st Term',
      className: 'Primary One',
      section: 'A',
      subjectScores: [
        { subjectId: 'sub-1', subjectName: "Qur'an", arabicName: 'القرآن الكريم', ca1: 18, ca2: 18, exam: 54, total: 90, grade: 'A', position: '2nd' },
        { subjectId: 'sub-2', subjectName: 'Tauhid', arabicName: 'التوحيد', ca1: 17, ca2: 18, exam: 53, total: 88, grade: 'A', position: '2nd' },
        { subjectId: 'sub-3', subjectName: "Qira'a", arabicName: 'القراءة', ca1: 17, ca2: 17, exam: 52, total: 86, grade: 'A', position: '2nd' },
      ],
      totalScore: 264,
      finalAverage: 88.0,
      finalPosition: '2nd',
      daysOpened: 90,
      daysPresent: 86,
      daysAbsent: 4,
      psychomotorRatings: { 'psy-1': 'A', 'psy-2': 'A', 'psy-3': 'A', 'psy-4': 'B', 'psy-5': 'A', 'psy-6': 'A', 'psy-7': 'A' },
      formTeacherName: 'Ustaza Aisha Muhammad Ardo',
      formTeacherComment: 'Very good academic progress and respectful conduct.',
      promotionRemark: 'PASS & PROMOTED',
      schoolCloses: '24th Dhul Hijjah 1447 / 10th June 2026',
      nextTermBegins: '04th Muharram 1448 / 20th July 2026',
      nextTermFees: '₦ 16,000',
      updatedAt: new Date().toISOString(),
    },
  ];

  const demoAttendance: AttendanceRecord[] = [
    {
      id: 'att-1',
      schoolId: 'school-main',
      studentId: 'STU-2026-001',
      academicSession: '2026/2027',
      term: '1st Term',
      className: 'Primary One',
      section: 'A',
      daysOpened: 90,
      daysPresent: 88,
      daysAbsent: 2,
      remark: 'Regular',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'att-2',
      schoolId: 'school-main',
      studentId: 'STU-2026-002',
      academicSession: '2026/2027',
      term: '1st Term',
      className: 'Primary One',
      section: 'A',
      daysOpened: 90,
      daysPresent: 86,
      daysAbsent: 4,
      remark: 'Regular',
      updatedAt: new Date().toISOString(),
    },
  ];

  const demoAuditLogs: AuditLogEntry[] = [
    {
      id: 'log-1',
      schoolId: 'school-main',
      userId: 'usr-admin',
      userName: 'Mallam Abubakar Lamido',
      userRole: 'super_admin',
      action: 'INITIAL_SETUP',
      details: 'Super Admin initialized At-Tahfiz Wal Itqan Islamic School profile',
      timestamp: new Date().toISOString(),
    },
  ];

  const db: AppDatabase = {
    schoolId: 'school-main',
    settings: {
      schoolId: 'school-main',
      schoolName: 'AT-TAHFIZU WAL ITQAN ISLAMIYYA, YOLA',
      arabicSchoolName: 'مدرسة التحفيظ والإتقان الإسلامية، يولا',
      motto: 'شعارنا: خيركم من تعلم القرآن وعلمه',
      address: 'Along Bypass Road, beside Bole Street Junction, Lamido Zubairu Way, Yola Town',
      telephone: '08033408522, 08058715879',
      email: 'attahfizul.itqan@gmail.com',
      website: 'www.attahfizul-itqan.edu.ng',
      currentSession: '2026/2027',
      currentTerm: '1st Term',
      logoUrl: SAMPLE_SCHOOL_LOGO,
      ca1Max: 20,
      ca2Max: 20,
      examMax: 60,
      isSetupComplete: true,
      useSections: true,
      lastBackupAt: new Date().toISOString(),
    },
    classes: demoClasses,
    sections: demoSections,
    subjects: demoSubjects,
    terms: ['1st Term', '2nd Term', '3rd Term'],
    sessions: ['2025/2026', '2026/2027', '2027/2028'],
    gradingBoundaries: [...DEFAULT_GRADING_BOUNDARIES],
    psychomotorItems: [...DEFAULT_PSYCHOMOTOR_ITEMS],
    students: demoStudents,
    assessments: rankAssessments(demoAssessments),
    attendance: demoAttendance,
    users: demoUsers,
    auditLogs: demoAuditLogs,
  };

  saveDatabase(db);
  return db;
}

export const resetDatabaseToDefault = loadDemoDevelopmentDatabase;

