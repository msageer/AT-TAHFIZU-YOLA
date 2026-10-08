export type UserRole = 'super_admin' | 'staff' | 'teacher';

export type StaffPermission =
  | 'students'
  | 'classes'
  | 'assessment'
  | 'attendance'
  | 'reports'
  | 'class-summary'
  | 'promotion'
  | 'import-export'
  | 'settings';

export interface UserAccount {
  id: string;
  email: string; // Used for login
  username?: string;
  fullName: string;
  phone?: string;
  passwordHash: string; // In-browser mock hashed password
  role: UserRole;
  schoolId: string;
  status: 'active' | 'disabled';
  // Teacher specific constraints
  assignedClass?: string;
  assignedSection?: string;
  assignedSession?: string;
  // Staff specific permissions
  permissions?: StaffPermission[];
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuditLogEntry {
  id: string;
  schoolId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
  timestamp: string;
}

export interface SchoolSettings {
  schoolId: string;
  schoolName: string;
  arabicSchoolName: string;
  motto: string;
  address: string;
  telephone: string;
  email: string;
  website?: string;
  currentSession: string;
  currentTerm: string;
  logoUrl: string; // base64 or URL
  ca1Max: number; // default 20
  ca2Max: number; // default 20
  examMax: number; // default 60
  isSetupComplete: boolean;
  useSections?: boolean;
  lastBackupAt?: string;
  // Leadership & Term Calendar Settings
  headTeacherName?: string; // Head Teacher / Principal Name
  schoolCloses?: string; // School Vacation / Closing Date
  nextTermBegins?: string; // School Resumption / Opening Date
  defaultNextTermFees?: string; // Global fallback fees e.g. "₦ 16,000"
  classFees?: Record<string, string>; // Per-class fees mapping e.g. { "Nursery One": "₦ 12,000" }
}

export interface ClassItem {
  id: string;
  schoolId?: string;
  name: string;
  order: number;
  sections?: string[]; // Specific sections/arms for this class: [] (Default / No Section), or ['A', 'B'] (Arms A & B)
  nextTermFees?: string; // Specific next term fees for this class e.g. "₦ 14,000"
  classTeacherName?: string; // Assigned class / form teacher name
}

export interface SectionItem {
  id: string;
  schoolId?: string;
  name: string;
}

export interface SubjectItem {
  id: string;
  schoolId?: string;
  name: string;
  arabicName: string;
  code?: string;
  isActive: boolean;
  applicableClasses?: string[]; // Empty or ['ALL'] means all classes
}

export interface GradeBoundary {
  min: number;
  max: number;
  grade: string;
  remark: string;
}

export interface PsychomotorItem {
  id: string;
  name: string;
}

export interface StudentHistoryEntry {
  session: string;
  term: string;
  className: string;
  section: string;
  totalScore?: number;
  finalAverage?: number;
  position?: string;
  date?: string;
  remark?: string;
}

export interface Student {
  id: string; // Internal unique ID
  schoolId?: string;
  studentId: string; // Unique student ID e.g. STU-2025-001
  admissionNumber: string; // Unique admission number e.g. ADM/2025/001
  name: string;
  className: string;
  section: string;
  gender: 'Male' | 'Female';
  dateOfBirth?: string;
  parentName?: string;
  parentPhone?: string;
  address?: string;
  admissionDate?: string;
  status: 'Active' | 'Inactive' | 'Graduated' | 'Withdrawn' | 'Promoted';
  photoUrl?: string;
  academicHistory?: StudentHistoryEntry[];
}

export interface SubjectScore {
  subjectId: string;
  subjectName: string;
  arabicName: string;
  ca1: number; // 0 - ca1Max
  ca2: number; // 0 - ca2Max
  exam: number; // 0 - examMax
  total: number; // calculated ca1 + ca2 + exam
  grade: string; // calculated e.g. A, B, C
  position?: string; // calculated rank in class e.g. 1st, 2nd
}

export interface AssessmentRecord {
  id: string;
  schoolId?: string;
  studentId: string;
  academicSession: string;
  term: string;
  className: string;
  section: string;
  
  // Cognitive
  subjectScores: SubjectScore[];
  totalScore: number;
  finalAverage: number;
  finalPosition?: string;
  
  // Attendance
  daysOpened: number;
  daysPresent: number;
  daysAbsent: number;

  // Psychomotor ratings (item id -> grade letter e.g. A, B, C)
  psychomotorRatings: Record<string, string>;

  // Form Teacher & School Term details
  formTeacherName: string;
  formTeacherComment: string;
  promotionRemark: string; // e.g. "PASS & PROMOTED", "PASS & REPEAT"
  schoolCloses: string;
  nextTermBegins: string;
  nextTermFees: string;

  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  schoolId?: string;
  studentId: string;
  academicSession: string;
  term: string;
  className: string;
  section: string;
  daysOpened: number;
  daysPresent: number;
  daysAbsent: number;
  remark?: string;
  updatedAt: string;
}

export interface TermClassConfig {
  id: string;
  academicSession: string;
  term: string;
  className: string;
  section: string;
  formTeacherName: string;
  schoolCloses: string;
  nextTermBegins: string;
  nextTermFees: string;
  daysOpened: number;
}

export type NavigationTab =
  | 'dashboard'
  | 'students'
  | 'classes'
  | 'assessment'
  | 'attendance'
  | 'reports'
  | 'class-summary'
  | 'promotion'
  | 'import-export'
  | 'users'
  | 'audit-log'
  | 'settings';

export interface AppDatabase {
  schoolId: string;
  settings: SchoolSettings;
  classes: ClassItem[];
  sections: SectionItem[];
  subjects: SubjectItem[];
  terms: string[];
  sessions: string[];
  gradingBoundaries: GradeBoundary[];
  psychomotorItems: PsychomotorItem[];
  students: Student[];
  assessments: AssessmentRecord[];
  attendance?: AttendanceRecord[];
  users: UserAccount[];
  auditLogs: AuditLogEntry[];
}
