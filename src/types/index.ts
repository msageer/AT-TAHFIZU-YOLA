export interface SchoolSettings {
  schoolName: string;
  arabicSchoolName: string;
  motto: string;
  address: string;
  telephone: string;
  email: string;
  currentSession: string;
  currentTerm: string;
  logoUrl: string; // base64 or URL
  ca1Max: number; // default 20
  ca2Max: number; // default 20
  examMax: number; // default 60
  isOnboarded?: boolean;
  lastBackupAt?: string;
}

export interface ClassItem {
  id: string;
  name: string;
  order: number;
}

export interface SectionItem {
  id: string;
  name: string;
}

export interface SubjectItem {
  id: string;
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
  | 'settings';

export interface AppDatabase {
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
}
