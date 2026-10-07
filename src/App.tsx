import React, { useState, useEffect } from 'react';
import {
  loadDatabase,
  saveDatabase,
  resetDatabaseToDefault,
  getCurrentSessionUser,
  setCurrentSessionUser,
  addAuditLog,
} from './storage/db';
import {
  setupRealtimeSync,
  syncDatabaseToFirestore,
  deleteStudentFromFirestore,
  deleteUserFromFirestore,
  setSyncDbSnapshot,
} from './storage/firebase';
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
  UserAccount,
} from './types';
import { rankAssessments } from './utils/ranking';
import { CheckCircle2, AlertTriangle, AlertOctagon, X } from 'lucide-react';
import { AuthPage } from './components/AuthPage';
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
import { UserManagement } from './components/UserManagement';
import { AuditLogView } from './components/AuditLogView';
import { Settings } from './components/Settings';

export default function App() {
  const [db, setDb] = useState<AppDatabase>(() => loadDatabase());
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() =>
    getCurrentSessionUser()
  );
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('syncing');

  // Real-time multi-device synchronization across devices and users
  useEffect(() => {
    const unsub = setupRealtimeSync(
      db,
      remoteDb => {
        setDb(remoteDb);
        saveDatabase(remoteDb);
      },
      status => setCloudSyncStatus(status)
    );
    return () => unsub();
  }, []);

  // Navigation state passes
  const [selectedAssessmentTarget, setSelectedAssessmentTarget] = useState<{
    studentId: string;
    className: string;
    section: string;
  } | null>(null);

  const [selectedReportStudentId, setSelectedReportStudentId] = useState<string | null>(null);
  const [selectedStudentForProfileId, setSelectedStudentForProfileId] = useState<string | null>(null);

  // User-facing database operation notifications
  const [dbNotification, setDbNotification] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    details?: string;
  } | null>(null);

  // Synchronize state with persistent storage and cloud with robust error catching and state preservation
  const updateDatabase = (newDb: AppDatabase): boolean => {
    const previousDb = db;
    try {
      // 1. Immediately update cloud sync accumulator so incoming snapshots don't lag
      setSyncDbSnapshot(newDb);

      // 2. Persist locally to storage (throws if storage quota is exceeded or storage is blocked)
      saveDatabase(newDb);

      // 3. Commit state into React
      setDb(newDb);

      // 4. Multi-device cloud sync with error catching
      syncDatabaseToFirestore(newDb)
        .then(() => {
          setCloudSyncStatus('synced');
        })
        .catch(err => {
          console.error('Multi-device cloud sync error:', err);
          setCloudSyncStatus('offline');
          setDbNotification({
            type: 'warning',
            message:
              'Data saved safely on this device, but multi-device cloud synchronization is currently offline.',
            details: err?.message || 'Check network connectivity or permissions.',
          });
        });

      // 5. User-facing success feedback
      setDbNotification({
        type: 'success',
        message: 'Changes saved successfully to database.',
      });

      // Auto-clear success notification after 4 seconds
      setTimeout(() => {
        setDbNotification(curr => (curr?.type === 'success' ? null : curr));
      }, 4000);

      return true;
    } catch (err: any) {
      console.error('Database save operation failed:', err);
      // STRICT STATE PRESERVATION: Revert to previous state
      setDb(previousDb);
      setSyncDbSnapshot(previousDb);
      try {
        saveDatabase(previousDb);
      } catch {
        // safety fallback
      }

      setDbNotification({
        type: 'error',
        message: `Database save failed! Previous state has been safely preserved.`,
        details: err?.message || 'Storage write quota or serialization error.',
      });
      return false;
    }
  };

  // ==========================================
  // AUTHENTICATION HANDLERS
  // ==========================================
  const handleLoginSuccess = (user: UserAccount) => {
    let updatedDb = addAuditLog(
      db,
      user,
      'USER_LOGIN',
      `User ${user.fullName} (${user.role}) signed in`
    );
    // Update lastLoginAt in users list
    const userIndex = updatedDb.users.findIndex(u => u.id === user.id);
    if (userIndex >= 0) {
      const updatedUsers = [...updatedDb.users];
      updatedUsers[userIndex] = { ...user, lastLoginAt: new Date().toISOString() };
      updatedDb = { ...updatedDb, users: updatedUsers };
      saveDatabase(updatedDb);
    }
    setDb(updatedDb);
    setCurrentUser(user);
    setCurrentSessionUser(user);
    setActiveTab('dashboard');
  };

  const handleInitializeSuperAdmin = (adminUser: UserAccount, settings: SchoolSettings) => {
    let updatedDb: AppDatabase = {
      ...db,
      settings,
      users: [adminUser],
    };
    updatedDb = addAuditLog(
      updatedDb,
      adminUser,
      'INITIAL_SETUP',
      `Super Admin ${adminUser.fullName} initialized school profile: ${settings.schoolName}`
    );
    updateDatabase(updatedDb);
    setCurrentUser(adminUser);
    setCurrentSessionUser(adminUser);
    setActiveTab('dashboard');
  };

  const handleLoadDemoData = () => {
    const demoDb = resetDatabaseToDefault();
    const admin = demoDb.users.find(u => u.role === 'super_admin') || demoDb.users[0];
    const withLog = addAuditLog(
      demoDb,
      admin,
      'DEMO_DATA_LOADED',
      'Loaded sample Islamic school dataset (At-Tahfiz Wal Itqan Islamiyya)'
    );
    setDb(withLog);
    setCurrentUser(admin);
    setCurrentSessionUser(admin);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    if (currentUser) {
      const withLog = addAuditLog(
        db,
        currentUser,
        'USER_LOGOUT',
        `User ${currentUser.fullName} signed out`
      );
      updateDatabase(withLog);
    }
    setCurrentUser(null);
    setCurrentSessionUser(null);
  };

  // ==========================================
  // USER ACCOUNTS CRUD (Super Admin)
  // ==========================================
  const handleSaveUser = (user: UserAccount) => {
    const existingIndex = db.users.findIndex(u => u.id === user.id);
    let updatedUsers = [...db.users];
    const isNew = existingIndex < 0;
    if (!isNew) {
      updatedUsers[existingIndex] = user;
    } else {
      updatedUsers = [user, ...db.users];
    }
    let updatedDb: AppDatabase = { ...db, users: updatedUsers };
    if (currentUser) {
      updatedDb = addAuditLog(
        updatedDb,
        currentUser,
        isNew ? 'CREATE_USER' : 'UPDATE_USER',
        `${isNew ? 'Created' : 'Updated'} account for ${user.fullName} (${user.role})`
      );
    }
    updateDatabase(updatedDb);

    // If current user modified their own profile, sync state
    if (currentUser && currentUser.id === user.id) {
      setCurrentUser(user);
      setCurrentSessionUser(user);
    }
  };

  const handleDeleteUser = (userId: string) => {
    const target = db.users.find(u => u.id === userId);
    const updatedUsers = db.users.filter(u => u.id !== userId);
    let updatedDb: AppDatabase = { ...db, users: updatedUsers };
    if (currentUser && target) {
      updatedDb = addAuditLog(
        updatedDb,
        currentUser,
        'DELETE_USER',
        `Removed user account for ${target.fullName} (${target.email})`
      );
    }
    updateDatabase(updatedDb);

    // Explicitly delete user from cloud Firestore
    deleteUserFromFirestore(userId).catch(err => {
      console.error('Failed to delete user from cloud:', err);
    });
  };

  // ==========================================
  // STUDENT CRUD
  // ==========================================
  const handleSaveStudent = (student: Student) => {
    const existingIndex = db.students.findIndex(s => s.id === student.id);
    let updatedStudents: Student[];
    const isNew = existingIndex < 0;
    if (!isNew) {
      updatedStudents = [...db.students];
      updatedStudents[existingIndex] = student;
    } else {
      updatedStudents = [student, ...db.students];
    }
    let updatedDb: AppDatabase = { ...db, students: updatedStudents };
    if (currentUser) {
      updatedDb = addAuditLog(
        updatedDb,
        currentUser,
        'SAVE_STUDENT',
        `${isNew ? 'Added student' : 'Updated student'} ${student.name} (${student.admissionNumber || student.studentId}) in ${student.className}`
      );
    }
    updateDatabase(updatedDb);
  };

  const handleDeleteStudent = (identifier: string) => {
    const targetStudent = db.students.find(
      s => s.id === identifier || s.studentId === identifier
    );
    const targetId = targetStudent?.id || identifier;
    const targetStudentId = targetStudent?.studentId || identifier;

    const updatedStudents = db.students.filter(
      s => s.id !== targetId && s.studentId !== targetStudentId
    );
    const updatedAssessments = db.assessments.filter(
      a => a.studentId !== targetStudentId && a.studentId !== targetId
    );
    const updatedAttendance = (db.attendance || []).filter(
      a => a.studentId !== targetStudentId && a.studentId !== targetId
    );

    let updatedDb: AppDatabase = {
      ...db,
      students: updatedStudents,
      assessments: updatedAssessments,
      attendance: updatedAttendance,
    };

    if (currentUser && targetStudent) {
      updatedDb = addAuditLog(
        updatedDb,
        currentUser,
        'DELETE_STUDENT',
        `Deleted student ${targetStudent.name} (${targetStudent.admissionNumber || targetStudent.studentId})`
      );
    }
    updateDatabase(updatedDb);

    // Explicitly delete from cloud Firestore so it doesn't resurrect on snapshot
    deleteStudentFromFirestore(targetId, targetStudentId).catch(err => {
      console.error('Failed to delete student from cloud:', err);
    });
  };

  const handleBatchDeleteStudents = (identifiers: string[]) => {
    if (!identifiers || identifiers.length === 0) return;
    const idSet = new Set(identifiers);
    const targetStudents = db.students.filter(
      s => idSet.has(s.id) || idSet.has(s.studentId)
    );
    const targetIdSet = new Set(targetStudents.map(s => s.id).concat(identifiers));
    const targetStudentIdSet = new Set(targetStudents.map(s => s.studentId).concat(identifiers));

    const updatedStudents = db.students.filter(
      s => !targetIdSet.has(s.id) && !targetStudentIdSet.has(s.studentId)
    );
    const updatedAssessments = db.assessments.filter(
      a => !targetStudentIdSet.has(a.studentId) && !targetIdSet.has(a.studentId)
    );
    const updatedAttendance = (db.attendance || []).filter(
      a => !targetStudentIdSet.has(a.studentId) && !targetIdSet.has(a.studentId)
    );

    let updatedDb: AppDatabase = {
      ...db,
      students: updatedStudents,
      assessments: updatedAssessments,
      attendance: updatedAttendance,
    };

    if (currentUser) {
      updatedDb = addAuditLog(
        updatedDb,
        currentUser,
        'BATCH_DELETE_STUDENTS',
        `Batch deleted ${targetStudents.length || identifiers.length} student records`
      );
    }
    updateDatabase(updatedDb);

    targetStudents.forEach(ts => {
      deleteStudentFromFirestore(ts.id, ts.studentId).catch(err => {
        console.error('Failed to delete student from cloud:', err);
      });
    });
  };

  // ==========================================
  // ASSESSMENT SAVE & RE-RANK
  // ==========================================
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
    let updatedDb: AppDatabase = { ...db, assessments: mergedAssessments };

    if (currentUser) {
      const studentObj = db.students.find(s => s.studentId === record.studentId);
      updatedDb = addAuditLog(
        updatedDb,
        currentUser,
        'SAVE_ASSESSMENT',
        `Recorded marks for ${studentObj ? studentObj.name : record.studentId} (${record.className} - Section ${record.section}) for ${record.term}`
      );
    }

    updateDatabase(updatedDb);
  };

  // ==========================================
  // ATTENDANCE SAVE BATCH
  // ==========================================
  const handleSaveAttendanceBatch = (records: AttendanceRecord[]) => {
    const existing = db.attendance || [];
    const recordMap = new Map(
      records.map(r => [`${r.studentId}-${r.academicSession}-${r.term}`, r])
    );

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

    let updatedDb: AppDatabase = {
      ...db,
      attendance: updatedAttendance,
      assessments: updatedAssessments,
    };

    if (currentUser && records.length > 0) {
      updatedDb = addAuditLog(
        updatedDb,
        currentUser,
        'SAVE_ATTENDANCE',
        `Updated attendance batch for ${records.length} students in ${records[0].className} (${records[0].term})`
      );
    }

    updateDatabase(updatedDb);
  };

  // ==========================================
  // STUDENT PROMOTION
  // ==========================================
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

    let updatedDb: AppDatabase = { ...db, students: updatedStudents };
    if (currentUser) {
      updatedDb = addAuditLog(
        updatedDb,
        currentUser,
        'PROMOTE_STUDENTS',
        `Promoted ${studentIds.length} students to ${toClass} (Section ${toSection})`
      );
    }
    updateDatabase(updatedDb);
  };

  // ==========================================
  // SPREADSHEET IMPORT & SETUP
  // ==========================================
  const handleImportStudents = (newStudents: Student[]) => {
    const merged = [...newStudents, ...db.students];
    let updatedDb: AppDatabase = { ...db, students: merged };
    if (currentUser) {
      updatedDb = addAuditLog(
        updatedDb,
        currentUser,
        'IMPORT_STUDENTS',
        `Imported ${newStudents.length} students from spreadsheet`
      );
    }
    updateDatabase(updatedDb);
  };

  const handleImportAssessmentSheet = (
    newStudents: Student[],
    newAssessments: AssessmentRecord[],
    newAttendance: AttendanceRecord[],
    detectedClasses: string[],
    detectedSections: string[]
  ) => {
    // 1. Auto-enroll new students without duplicate IDs
    const existingIds = new Set(db.students.map(s => s.id));
    const studentsToAppend = newStudents.filter(s => !existingIds.has(s.id));
    const mergedStudents = [...db.students, ...studentsToAppend];

    // 2. Merge assessments and replace any matching by (studentId, session, term)
    const assessmentMap = new Map<string, AssessmentRecord>();
    db.assessments.forEach(a => assessmentMap.set(`${a.studentId}__${a.academicSession}__${a.term}`, a));
    newAssessments.forEach(a => assessmentMap.set(`${a.studentId}__${a.academicSession}__${a.term}`, a));
    const mergedAssessments = Array.from(assessmentMap.values());

    // 3. Merge attendance
    const attendanceMap = new Map<string, AttendanceRecord>();
    (db.attendance || []).forEach(att => attendanceMap.set(`${att.studentId}__${att.academicSession}__${att.term}`, att));
    newAttendance.forEach(att => attendanceMap.set(`${att.studentId}__${att.academicSession}__${att.term}`, att));
    const mergedAttendance = Array.from(attendanceMap.values());

    // 4. Auto-create any new classes or sections found in the sheet
    const existingClassNames = new Set(db.classes.map(c => c.name.toLowerCase()));
    const classesToAdd: ClassItem[] = detectedClasses
      .filter(cn => cn && !existingClassNames.has(cn.toLowerCase()))
      .map((cn, i) => ({
        id: `cls-auto-${Date.now()}-${i}`,
        name: cn,
        order: db.classes.length + i + 1,
        schoolId: db.schoolId,
      }));

    const existingSectionNames = new Set(db.sections.map(s => s.name.toLowerCase()));
    const sectionsToAdd: SectionItem[] = detectedSections
      .filter(sn => sn && !existingSectionNames.has(sn.toLowerCase()))
      .map((sn, i) => ({
        id: `sec-auto-${Date.now()}-${i}`,
        name: sn,
        schoolId: db.schoolId,
      }));

    let updatedDb: AppDatabase = {
      ...db,
      students: mergedStudents,
      assessments: mergedAssessments,
      attendance: mergedAttendance,
      classes: [...db.classes, ...classesToAdd],
      sections: [...db.sections, ...sectionsToAdd],
    };

    if (currentUser) {
      updatedDb = addAuditLog(
        updatedDb,
        currentUser,
        'IMPORT_ASSESSMENT_SHEET',
        `Imported Assessment Sheet: Auto-enrolled ${studentsToAppend.length} students and recorded ${newAssessments.length} assessment records`
      );
    }
    updateDatabase(updatedDb);
  };

  const handleAutoAddClasses = (newClasses: ClassItem[]) => {
    updateDatabase({ ...db, classes: [...db.classes, ...newClasses] });
  };

  const handleAutoAddSections = (newSections: SectionItem[]) => {
    updateDatabase({ ...db, sections: [...db.sections, ...newSections] });
  };

  const handleResetDefaults = () => {
    const reset = resetDatabaseToDefault();
    setDb(reset);
  };

  const handleClearAuditLogs = () => {
    const updated = { ...db, auditLogs: [] };
    updateDatabase(updated);
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

  const handleGlobalSearchSelectStudent = (
    student: Student,
    action: 'profile' | 'assessment' | 'report' = 'profile'
  ) => {
    if (action === 'assessment') {
      navigateToAssessment(student.studentId, student.className, student.section);
    } else if (action === 'report') {
      navigateToReport(student.studentId);
    } else {
      setSelectedStudentForProfileId(student.id || student.studentId);
      setActiveTab('students');
    }
  };

  // ==========================================
  // UNAUTHENTICATED USERS: SHOW LOGIN / SETUP ONLY
  // No school information, no students, no reports, no stats
  // ==========================================
  if (!currentUser) {
    return (
      <AuthPage
        db={db}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  // ==========================================
  // AUTHENTICATED USER PORTAL (Role Restricted)
  // ==========================================
  const isSuperAdmin = currentUser.role === 'super_admin';
  const isTeacher = currentUser.role === 'teacher';
  const isStaff = currentUser.role === 'staff';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={tab => {
          if (tab !== 'assessment') setSelectedAssessmentTarget(null);
          if (tab !== 'reports') setSelectedReportStudentId(null);
          if (tab !== 'students') setSelectedStudentForProfileId(null);
          setActiveTab(tab);
        }}
        settings={db.settings}
        currentUser={currentUser}
        onLogout={handleLogout}
        syncStatus={cloudSyncStatus}
        students={db.students}
        onSelectStudent={handleGlobalSearchSelectStudent}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4 print:p-0 print:m-0 print:max-w-none print:w-full print:space-y-0">
        {/* User-facing Database Operation Notification */}
        {dbNotification && (
          <div
            className={`no-print p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs shadow-sm transition-all animate-fadeIn ${
              dbNotification.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-900'
                : dbNotification.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
            role="alert"
          >
            <div className="flex items-start space-x-2.5">
              {dbNotification.type === 'error' ? (
                <AlertOctagon className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              ) : dbNotification.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className="font-semibold">{dbNotification.message}</p>
                {dbNotification.details && (
                  <p className="text-[11px] opacity-80 mt-0.5 font-mono">
                    {dbNotification.details}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setDbNotification(null)}
              className="p-1 rounded-md hover:bg-black/5 opacity-70 hover:opacity-100 transition"
              title="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {activeTab === 'dashboard' && (
          <Dashboard
            db={db}
            currentUser={currentUser}
            setActiveTab={setActiveTab}
            onSelectAssessmentStudent={navigateToAssessment}
          />
        )}

        {activeTab === 'students' && (
          <Students
            db={db}
            currentUser={currentUser}
            initialSelectedStudentId={selectedStudentForProfileId}
            onClearSelectedStudentId={() => setSelectedStudentForProfileId(null)}
            onSaveStudent={handleSaveStudent}
            onDeleteStudent={handleDeleteStudent}
            onBatchDeleteStudents={handleBatchDeleteStudents}
            setActiveTab={setActiveTab}
            onSelectAssessmentStudent={navigateToAssessment}
            onSelectReportStudent={navigateToReport}
          />
        )}

        {activeTab === 'classes' && (
          <ClassView
            db={db}
            currentUser={currentUser}
            setActiveTab={setActiveTab}
            onSelectAssessmentStudent={navigateToAssessment}
            onSelectReportStudent={navigateToReport}
          />
        )}

        {activeTab === 'assessment' && (
          <AssessmentEntry
            db={db}
            currentUser={currentUser}
            initialStudentId={selectedAssessmentTarget?.studentId}
            initialClass={selectedAssessmentTarget?.className}
            initialSection={selectedAssessmentTarget?.section}
            onSaveAssessment={handleSaveAssessment}
            onImportAssessmentSheet={handleImportAssessmentSheet}
            setActiveTab={setActiveTab}
            onSelectReportStudent={navigateToReport}
          />
        )}

        {activeTab === 'attendance' && (
          <AttendanceManager
            db={db}
            currentUser={currentUser}
            onSaveAttendanceBatch={handleSaveAttendanceBatch}
          />
        )}

        {activeTab === 'reports' && (
          <ReportCenter
            db={db}
            currentUser={currentUser}
            initialStudentId={selectedReportStudentId || undefined}
          />
        )}

        {activeTab === 'class-summary' && (
          <ClassSummary
            db={db}
            currentUser={currentUser}
            setActiveTab={setActiveTab}
            onSelectReportStudent={navigateToReport}
          />
        )}

        {/* Super Admin & Authorized Staff Tabs */}
        {activeTab === 'promotion' && (!isTeacher) && (
          <StudentPromotion
            db={db}
            onPromoteStudents={handlePromoteStudents}
          />
        )}

        {activeTab === 'import-export' && (!isTeacher) && (
          <ExcelManager
            db={db}
            onImportStudents={handleImportStudents}
            onImportAssessmentSheet={handleImportAssessmentSheet}
            onAutoAddClasses={handleAutoAddClasses}
            onAutoAddSections={handleAutoAddSections}
          />
        )}

        {/* Super Admin Only: User Accounts & Roles */}
        {activeTab === 'users' && isSuperAdmin && (
          <UserManagement
            db={db}
            currentUser={currentUser}
            onSaveUser={handleSaveUser}
            onDeleteUser={handleDeleteUser}
          />
        )}

        {/* Super Admin Only: Security & Activity Audit Trail */}
        {activeTab === 'audit-log' && isSuperAdmin && (
          <AuditLogView
            logs={db.auditLogs || []}
            currentUser={currentUser}
            onClearLogs={handleClearAuditLogs}
          />
        )}

        {/* School Setup / Settings */}
        {activeTab === 'settings' && (!isTeacher) && (
          <Settings
            db={db}
            onUpdateDb={updateDatabase}
            onResetDefaults={handleResetDefaults}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="no-print bg-slate-900 text-slate-400 border-t border-slate-800 text-xs py-5 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-amiri font-bold text-sm text-emerald-400">
              {db.settings.arabicSchoolName || 'التحفيظ والإتقان'}
            </span>
            <span>&bull;</span>
            <span className="font-semibold text-slate-200">{db.settings.schoolName || 'Islamic School System'}</span>
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
