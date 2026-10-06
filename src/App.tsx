import React, { useState } from 'react';
import {
  loadDatabase,
  saveDatabase,
  resetDatabaseToDefault,
} from './storage/db';
import {
  AppDatabase,
  Student,
  AssessmentRecord,
  SubjectItem,
  NavigationTab,
  AttendanceRecord,
  ClassItem,
  SectionItem,
  StudentHistoryEntry,
  SchoolSettings,
} from './types';
import { rankAssessments } from './utils/ranking';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { Students } from './components/Students';
import { ClassView } from './components/ClassView';
import { AssessmentEntry } from './components/AssessmentEntry';
import { AttendanceManager } from './components/AttendanceManager';
import { ClassSummary } from './components/ClassSummary';
import { ReportCenter } from './components/ReportCenter';
import { StudentPromotion } from './components/StudentPromotion';
import { ExcelManager } from './components/ExcelManager';
import { Settings } from './components/Settings';
import { OnboardingWizard } from './components/OnboardingWizard';

export default function App() {
  const [db, setDb] = useState<AppDatabase>(() => loadDatabase());
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'teacher'>('admin');

  // Navigation state passes
  const [selectedAssessmentTarget, setSelectedAssessmentTarget] = useState<{
    studentId: string;
    className: string;
    section: string;
  } | null>(null);

  const [selectedReportStudentId, setSelectedReportStudentId] = useState<string | null>(null);

  // Synchronize state with persistent storage
  const updateDatabase = (newDb: AppDatabase) => {
    setDb(newDb);
    saveDatabase(newDb);
  };

  // Student CRUD
  const handleSaveStudent = (student: Student) => {
    const existingIndex = db.students.findIndex(s => s.id === student.id);
    let updatedStudents: Student[];
    if (existingIndex >= 0) {
      updatedStudents = [...db.students];
      updatedStudents[existingIndex] = student;
    } else {
      updatedStudents = [student, ...db.students];
    }
    updateDatabase({ ...db, students: updatedStudents });
  };

  const handleDeleteStudent = (studentInternalId: string) => {
    const targetStudent = db.students.find(s => s.id === studentInternalId);
    const updatedStudents = db.students.filter(s => s.id !== studentInternalId);
    const updatedAssessments = targetStudent
      ? db.assessments.filter(a => a.studentId !== targetStudent.studentId)
      : db.assessments;
    const updatedAttendance = targetStudent
      ? (db.attendance || []).filter(a => a.studentId !== targetStudent.studentId)
      : db.attendance;

    updateDatabase({
      ...db,
      students: updatedStudents,
      assessments: updatedAssessments,
      attendance: updatedAttendance,
    });
  };

  // Assessment Save & Recalculate Class Ranks
  const handleSaveAssessment = (record: AssessmentRecord) => {
    // 1. Replace or insert the assessment record
    const existingIndex = db.assessments.findIndex(
      a =>
        a.studentId === record.studentId &&
        a.academicSession === record.academicSession &&
        a.term === record.term
    );

    let list = [...db.assessments];
    if (existingIndex >= 0) {
      list[existingIndex] = record;
    } else {
      list.push(record);
    }

    // 2. Re-rank all students in this class/section/session/term
    const classGroup = list.filter(
      a =>
        a.className === record.className &&
        a.section === record.section &&
        a.academicSession === record.academicSession &&
        a.term === record.term
    );
    const rankedClassGroup = rankAssessments(classGroup);

    // 3. Merge back into full assessments array
    const otherRecords = list.filter(
      a =>
        !(
          a.className === record.className &&
          a.section === record.section &&
          a.academicSession === record.academicSession &&
          a.term === record.term
        )
    );

    const mergedAssessments = [...otherRecords, ...rankedClassGroup];
    updateDatabase({ ...db, assessments: mergedAssessments });
  };

  // Attendance Save Batch
  const handleSaveAttendanceBatch = (records: AttendanceRecord[]) => {
    const existing = db.attendance || [];
    const recordMap = new Map(records.map(r => [`${r.studentId}-${r.academicSession}-${r.term}`, r]));

    const retained = existing.filter(
      r => !recordMap.has(`${r.studentId}-${r.academicSession}-${r.term}`)
    );
    const updatedAttendance = [...retained, ...records];

    // Synchronize attendance into assessment records as well for seamless report printing
    const updatedAssessments = db.assessments.map(asm => {
      const match = recordMap.get(`${asm.studentId}-${asm.academicSession}-${asm.term}`);
      if (match) {
        return {
          ...asm,
          daysOpened: match.daysOpened,
          daysPresent: match.daysPresent,
          daysAbsent: match.daysAbsent,
        };
      }
      return asm;
    });

    updateDatabase({
      ...db,
      attendance: updatedAttendance,
      assessments: updatedAssessments,
    });
  };

  // Student Promotion Handlers
  const handlePromoteStudents = (
    studentIds: string[],
    toClass: string,
    toSection: string,
    historyEntries: Record<string, StudentHistoryEntry>
  ) => {
    const updatedStudents = db.students.map(s => {
      if (studentIds.includes(s.id)) {
        const history = s.academicHistory ? [...s.academicHistory] : [];
        if (historyEntries[s.id]) {
          history.push(historyEntries[s.id]);
        }
        return {
          ...s,
          className: toClass,
          section: toSection || s.section,
          status: 'Active' as const,
          academicHistory: history,
        };
      }
      return s;
    });

    updateDatabase({ ...db, students: updatedStudents });
  };

  // Bulk Import Students from Excel / Spreadsheet
  const handleImportStudents = (newStudents: Student[]) => {
    const merged = [...newStudents, ...db.students];
    updateDatabase({ ...db, students: merged });
  };

  // Auto-Add Classes & Sections detected in spreadsheet
  const handleAutoAddClasses = (newClasses: ClassItem[]) => {
    updateDatabase({ ...db, classes: [...db.classes, ...newClasses] });
  };

  const handleAutoAddSections = (newSections: SectionItem[]) => {
    updateDatabase({ ...db, sections: [...db.sections, ...newSections] });
  };

  // Complete Onboarding Wizard
  const handleCompleteOnboarding = (data: {
    settings: SchoolSettings;
    newClasses: ClassItem[];
    newSections: SectionItem[];
    importedStudents: Student[];
  }) => {
    const mergedStudents =
      data.importedStudents.length > 0
        ? [...data.importedStudents, ...db.students]
        : db.students;

    updateDatabase({
      ...db,
      settings: data.settings,
      classes: data.newClasses,
      sections: data.newSections,
      students: mergedStudents,
    });
    setIsOnboardingOpen(false);
    setActiveTab('dashboard');
  };

  // Reset to default sample database
  const handleResetDefaults = () => {
    const reset = resetDatabaseToDefault();
    setDb(reset);
  };

  // Quick action navigators
  const navigateToAssessment = (studentId: string, className: string, section: string) => {
    setSelectedAssessmentTarget({ studentId, className, section });
    setActiveTab('assessment');
  };

  const navigateToReport = (studentId: string) => {
    setSelectedReportStudentId(studentId);
    setActiveTab('reports');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={tab => {
          if (tab !== 'assessment') setSelectedAssessmentTarget(null);
          if (tab !== 'reports') setSelectedReportStudentId(null);
          setActiveTab(tab);
        }}
        settings={db.settings}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        userRole={userRole}
        onToggleRole={() => setUserRole(prev => (prev === 'admin' ? 'teacher' : 'admin'))}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            db={db}
            setActiveTab={setActiveTab}
            onSelectAssessmentStudent={navigateToAssessment}
            onOpenOnboarding={() => setIsOnboardingOpen(true)}
          />
        )}

        {activeTab === 'students' && (
          <Students
            db={db}
            onSaveStudent={handleSaveStudent}
            onDeleteStudent={handleDeleteStudent}
            setActiveTab={setActiveTab}
            onSelectAssessmentStudent={navigateToAssessment}
            onSelectReportStudent={navigateToReport}
          />
        )}

        {activeTab === 'classes' && (
          <ClassView
            db={db}
            setActiveTab={setActiveTab}
            onSelectAssessmentStudent={navigateToAssessment}
            onSelectReportStudent={navigateToReport}
          />
        )}

        {activeTab === 'assessment' && (
          <AssessmentEntry
            db={db}
            initialStudentId={selectedAssessmentTarget?.studentId}
            initialClass={selectedAssessmentTarget?.className}
            initialSection={selectedAssessmentTarget?.section}
            onSaveAssessment={handleSaveAssessment}
            setActiveTab={setActiveTab}
            onSelectReportStudent={navigateToReport}
          />
        )}

        {activeTab === 'attendance' && (
          <AttendanceManager
            db={db}
            onSaveAttendanceBatch={handleSaveAttendanceBatch}
          />
        )}

        {activeTab === 'reports' && (
          <ReportCenter
            db={db}
            initialStudentId={selectedReportStudentId || undefined}
          />
        )}

        {activeTab === 'class-summary' && (
          <ClassSummary
            db={db}
            setActiveTab={setActiveTab}
            onSelectReportStudent={navigateToReport}
          />
        )}

        {activeTab === 'promotion' && (
          <StudentPromotion
            db={db}
            onPromoteStudents={handlePromoteStudents}
          />
        )}

        {activeTab === 'import-export' && (
          <ExcelManager
            db={db}
            onImportStudents={handleImportStudents}
            onAutoAddClasses={handleAutoAddClasses}
            onAutoAddSections={handleAutoAddSections}
          />
        )}

        {activeTab === 'settings' && (
          <Settings
            db={db}
            onUpdateDb={updateDatabase}
            onResetDefaults={handleResetDefaults}
          />
        )}
      </main>

      {/* Onboarding Wizard Modal */}
      {isOnboardingOpen && (
        <OnboardingWizard
          db={db}
          onCompleteOnboarding={handleCompleteOnboarding}
          onClose={() => setIsOnboardingOpen(false)}
        />
      )}

      {/* Footer */}
      <footer className="no-print bg-slate-900 text-slate-400 border-t border-slate-800 text-xs py-5 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-amiri font-bold text-sm text-emerald-400">
              {db.settings.arabicSchoolName || 'التحفيظ والإتقان'}
            </span>
            <span>&bull;</span>
            <span className="font-semibold text-slate-200">{db.settings.schoolName}</span>
          </div>
          <div className="text-slate-400">
            Powered by{' '}
            <strong className="text-slate-200">
              M-SAGEER DIGITAL TECHNOLOGIES LTD &bull; 07066979027
            </strong>
          </div>
        </div>
      </footer>
    </div>
  );
}
