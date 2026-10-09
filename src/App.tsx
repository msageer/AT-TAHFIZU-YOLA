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
  isQuotaExhausted,
  isQuotaExceededError,
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
    try {
      // 1. Immediately update cloud sync accumulator
      setSyncDbSnapshot(newDb);

      // 2. Commit state into React first so user work is never lost
      setDb(newDb);

      // 3. Persist locally to storage (resilient against quota)
      saveDatabase(newDb);

      // 4. Multi-device cloud sync with error catching
      if (isQuotaExhausted()) {
        setCloudSyncStatus('offline');
      } else {
        syncDatabaseToFirestore(newDb)
          .then(() => {
            if (isQuotaExhausted()) {
              setCloudSyncStatus('offline');
            } else {
              setCloudSyncStatus('synced');
            }
          })
          .catch(err => {
            setCloudSyncStatus('offline');
            if (!isQuotaExceededError(err)) {
              console.warn('Multi-device cloud sync offline:', err);
            }
          });
      }

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
      console.error('Database save operation encountered an issue:', err);
      // Keep newDb in state so user data is NEVER wiped!
      setDb(newDb);
      setDbNotification({
        type: 'warning',
        message: `Changes saved in memory. Notice: ${err?.message || 'Storage quota warning'}`,
      });
      return true;
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
        a.id === record.id ||
        (a.studentId === record.studentId &&
          a.academicSession === record.academicSession &&
          a.term === record.term)
    );

    let list = [...db.assessments];
    if (existingIndex >= 0) {
      list[existingIndex] = record;
    } else {
      list.push(record);
    }

    // 2. Re-rank all students in this class/section/session/term
    const cleanClassName = (record.className || '').toLowerCase().trim();
    const cleanSection = (record.section || '').toUpperCase().trim();
    const classGroup = list.filter(
      a =>
        (a.className || '').toLowerCase().trim() === cleanClassName &&
        (a.section || '').toUpperCase().trim() === cleanSection &&
        a.academicSession === record.academicSession &&
        a.term === record.term
    );
    const rankedClassGroup = rankAssessments(classGroup);

    // 3. Merge back into full assessments array - exclude only records replaced in rankedClassGroup by unique record ID
    const rankedIds = new Set(rankedClassGroup.map(r => r.id));
    const otherRecords = list.filter(a => !rankedIds.has(a.id));

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
      records.map(r => [
        `${r.studentId}__${(r.className || '').toLowerCase().trim()}__${r.academicSession}__${r.term}`,
        r,
      ])
    );

    const retained = existing.filter(
      r =>
        !recordMap.has(
          `${r.studentId}__${(r.className || '').toLowerCase().trim()}__${r.academicSession}__${r.term}`
        )
    );
    const updatedAttendance = [...retained, ...records];

    // Synchronize attendance into assessment records as well for seamless report printing
    const updatedAssessments = db.assessments.map(asm => {
      const match = recordMap.get(
        `${asm.studentId}__${(asm.className || '').toLowerCase().trim()}__${asm.academicSession}__${asm.term}`
      );
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
    sheetStudents: Student[],
    newAssessments: AssessmentRecord[],
    newAttendance: AttendanceRecord[],
    detectedClasses: string[],
    detectedSections: string[]
  ) => {
    // 1. ADD OR OVERWRITE STUDENTS
    // If student is not added, add it; if student is already present, overwrite it!
    const studentList = [...db.students];
    let newlyAddedCount = 0;
    let overwrittenCount = 0;

    sheetStudents.forEach(sheetStu => {
      const matchIndex = studentList.findIndex(
        s =>
          s.id === sheetStu.id ||
          (sheetStu.admissionNumber &&
            s.admissionNumber &&
            s.admissionNumber.toLowerCase().trim() === sheetStu.admissionNumber.toLowerCase().trim()) ||
          (sheetStu.studentId &&
            s.studentId &&
            s.studentId.toLowerCase().trim() === sheetStu.studentId.toLowerCase().trim()) ||
          (s.name.toLowerCase().trim() === sheetStu.name.toLowerCase().trim() &&
            s.className.toLowerCase().trim() === sheetStu.className.toLowerCase().trim())
      );

      if (matchIndex >= 0) {
        // OVERWRITE existing student with updated fields from sheet
        const existing = studentList[matchIndex];
        studentList[matchIndex] = {
          ...existing,
          name: sheetStu.name || existing.name,
          className: sheetStu.className || existing.className,
          section: sheetStu.section !== undefined ? sheetStu.section : existing.section,
          gender: sheetStu.gender || existing.gender,
          admissionNumber: sheetStu.admissionNumber || existing.admissionNumber,
          studentId: sheetStu.studentId || existing.studentId,
          status: 'Active',
          academicHistory: [
            ...(existing.academicHistory || []).filter(
              h =>
                !(
                  sheetStu.academicHistory?.[0] &&
                  h.session === sheetStu.academicHistory[0].session &&
                  h.term === sheetStu.academicHistory[0].term
                )
            ),
            ...(sheetStu.academicHistory || []),
          ],
        };
        overwrittenCount++;
      } else {
        // ADD new student
        studentList.push(sheetStu);
        newlyAddedCount++;
      }
    });

    // 2. ADD OR OVERWRITE ASSESSMENTS
    // If assessment is not added, add it; if assessment is already present, overwrite it!
    const assessmentList = [...db.assessments];
    let newAssessmentsCount = 0;
    let overwrittenAssessmentsCount = 0;

    newAssessments.forEach(newAsm => {
      // Find matching student in studentList to ensure studentId is canonical
      const stu = studentList.find(
        s =>
          s.studentId.toLowerCase().trim() === newAsm.studentId.toLowerCase().trim() ||
          (s.admissionNumber &&
            s.admissionNumber.toLowerCase().trim() === newAsm.studentId.toLowerCase().trim()) ||
          s.id === newAsm.studentId
      );
      if (stu) {
        newAsm.studentId = stu.studentId;
      }

      const normSession = (newAsm.academicSession || '').toLowerCase().trim();
      const normTerm = (newAsm.term || '').toLowerCase().trim();

      const existingAsmIdx = assessmentList.findIndex(a => {
        const aNormSession = (a.academicSession || '').toLowerCase().trim();
        const aNormTerm = (a.term || '').toLowerCase().trim();
        if (aNormSession !== normSession || aNormTerm !== normTerm) return false;

        return (
          a.id === newAsm.id ||
          a.studentId.toLowerCase().trim() === newAsm.studentId.toLowerCase().trim() ||
          (stu &&
            (a.studentId === stu.id ||
              (stu.admissionNumber &&
                a.studentId.toLowerCase().trim() === stu.admissionNumber.toLowerCase().trim())))
        );
      });

      if (existingAsmIdx >= 0) {
        // OVERWRITE existing assessment
        assessmentList[existingAsmIdx] = {
          ...assessmentList[existingAsmIdx],
          ...newAsm,
          id: assessmentList[existingAsmIdx].id,
          updatedAt: new Date().toISOString(),
        };
        overwrittenAssessmentsCount++;
      } else {
        // ADD new assessment
        assessmentList.push(newAsm);
        newAssessmentsCount++;
      }
    });

    // 3. Re-rank all affected classes/sections/sessions/terms
    const affectedGroupKeys = new Set(
      newAssessments.map(
        a =>
          `${(a.className || '').toLowerCase().trim()}__${(a.section || '').toUpperCase().trim()}__${a.academicSession}__${a.term}`
      )
    );

    let finalAssessments = [...assessmentList];
    affectedGroupKeys.forEach(groupKey => {
      const [cls, sec, sess, trm] = groupKey.split('__');
      const groupRecords = finalAssessments.filter(
        a =>
          (a.className || '').toLowerCase().trim() === cls &&
          (a.section || '').toUpperCase().trim() === sec &&
          a.academicSession === sess &&
          a.term === trm
      );
      if (groupRecords.length > 0) {
        const rankedGroup = rankAssessments(groupRecords);
        const rankedMap = new Map(rankedGroup.map(r => [r.id, r]));
        finalAssessments = finalAssessments.map(a => rankedMap.get(a.id) || a);
      }
    });

    // 4. ADD OR OVERWRITE ATTENDANCE
    const attendanceList = [...(db.attendance || [])];
    newAttendance.forEach(newAtt => {
      const normSession = (newAtt.academicSession || '').toLowerCase().trim();
      const normTerm = (newAtt.term || '').toLowerCase().trim();

      const existingAttIdx = attendanceList.findIndex(att => {
        const attNormSession = (att.academicSession || '').toLowerCase().trim();
        const attNormTerm = (att.term || '').toLowerCase().trim();
        return (
          att.id === newAtt.id ||
          (attNormSession === normSession &&
            attNormTerm === normTerm &&
            att.studentId.toLowerCase().trim() === newAtt.studentId.toLowerCase().trim())
        );
      });

      if (existingAttIdx >= 0) {
        attendanceList[existingAttIdx] = {
          ...attendanceList[existingAttIdx],
          ...newAtt,
          id: attendanceList[existingAttIdx].id,
          updatedAt: new Date().toISOString(),
        };
      } else {
        attendanceList.push(newAtt);
      }
    });

    // 5. Auto-create any new classes or sections found in the sheet
    const existingClassNames = new Set(db.classes.map(c => c.name.toLowerCase().trim()));
    const classesToAdd: ClassItem[] = detectedClasses
      .filter(cn => cn && !existingClassNames.has(cn.toLowerCase().trim()))
      .map((cn, i) => ({
        id: `cls-auto-${Date.now()}-${i}`,
        name: cn.trim(),
        order: db.classes.length + i + 1,
        schoolId: db.schoolId,
      }));

    const existingSectionNames = new Set(db.sections.map(s => s.name.toLowerCase().trim()));
    const sectionsToAdd: SectionItem[] = detectedSections
      .filter(sn => sn && !existingSectionNames.has(sn.toLowerCase().trim()))
      .map((sn, i) => ({
        id: `sec-auto-${Date.now()}-${i}`,
        name: sn.trim(),
        schoolId: db.schoolId,
      }));

    let updatedDb: AppDatabase = {
      ...db,
      students: studentList,
      assessments: finalAssessments,
      attendance: attendanceList,
      classes: [...db.classes, ...classesToAdd],
      sections: [...db.sections, ...sectionsToAdd],
    };

    if (currentUser) {
      updatedDb = addAuditLog(
        updatedDb,
        currentUser,
        'IMPORT_ASSESSMENT_SHEET',
        `Imported Assessment Sheet: ${newlyAddedCount} students added, ${overwrittenCount} students updated/overwritten, ${newAssessmentsCount} assessments created, ${overwrittenAssessmentsCount} assessments updated/overwritten`
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
            onSaveStudent={handleSaveStudent}
            onSelectStudentProfile={studentId => {
              setSelectedStudentForProfileId(studentId);
              setActiveTab('students');
            }}
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
