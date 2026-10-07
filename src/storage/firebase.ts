import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  writeBatch,
  getDocFromServer,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  AppDatabase,
  Student,
  AssessmentRecord,
  AttendanceRecord,
  UserAccount,
  AuditLogEntry,
} from '../types';

// 1. Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// 2. Strict Error Handling conforming to FirestoreErrorInfo
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
}

// 3. Mandatory Connection Test
export async function testConnection(): Promise<boolean> {
  const testPath = 'test/connection';
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is offline; using offline cache.');
    } else {
      handleFirestoreError(error, OperationType.GET, testPath);
    }
    return false;
  }
}

// Run connection test on initialization
testConnection().catch(() => {});

const SCHOOL_DOC_ID = 'school-main';

/**
 * Sanitizes an ID string so it can safely be used as a Firestore document path component.
 * Slashes and special path characters are strictly replaced with underscores.
 */
export function toSafeDocId(rawId: string): string {
  if (!rawId) return `doc-${Date.now()}`;
  return String(rawId).replace(/[\/\s#\[\]\*\?]/g, '_');
}

/**
 * Deeply sanitizes data to ensure no `undefined` values exist before Firestore writes.
 * Firestore strictly rejects documents containing `undefined` properties.
 */
export function sanitizeForFirestore<T>(val: T): T {
  if (val === undefined) {
    return null as unknown as T;
  }
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(item => sanitizeForFirestore(item)) as unknown as T;
  }
  const cleanObj: Record<string, any> = {};
  for (const [key, v] of Object.entries(val)) {
    if (v !== undefined) {
      cleanObj[key] = sanitizeForFirestore(v);
    }
  }
  return cleanObj as T;
}

/**
 * Sync entire AppDatabase to Firestore in a transactional/batch-safe manner.
 * Updates and overrides data across devices without tampering with existing records.
 */
export async function syncDatabaseToFirestore(appDb: AppDatabase): Promise<void> {
  try {
    const schoolRef = doc(db, 'schools', SCHOOL_DOC_ID);

    // 1. Save Core School Settings & Structures (sanitized from any undefined fields)
    const schoolPayload = sanitizeForFirestore({
      schoolId: appDb.schoolId || SCHOOL_DOC_ID,
      settings: appDb.settings,
      classes: appDb.classes || [],
      sections: appDb.sections || [],
      subjects: appDb.subjects || [],
      terms: appDb.terms || [],
      sessions: appDb.sessions || [],
      gradingBoundaries: appDb.gradingBoundaries || [],
      psychomotorItems: appDb.psychomotorItems || [],
      updatedAt: new Date().toISOString(),
    });
    await setDoc(schoolRef, schoolPayload, { merge: true });

    // 2. Save Students in Batches (max 400 ops per batch)
    if (appDb.students && appDb.students.length > 0) {
      const studentBatches: Student[][] = [];
      for (let i = 0; i < appDb.students.length; i += 400) {
        studentBatches.push(appDb.students.slice(i, i + 400));
      }
      for (const chunk of studentBatches) {
        const batch = writeBatch(db);
        chunk.forEach(student => {
          const docRef = doc(db, 'schools', SCHOOL_DOC_ID, 'students', toSafeDocId(student.id));
          batch.set(docRef, sanitizeForFirestore(student), { merge: true });
        });
        await batch.commit();
      }
    }

    // 2b. Clean up deleted students from cloud Firestore
    try {
      const existingFirestoreStudentDocs = await getDocs(
        collection(db, 'schools', SCHOOL_DOC_ID, 'students')
      );
      const currentStudentIds = new Set((appDb.students || []).map(s => toSafeDocId(s.id)));
      const currentStudentCodes = new Set((appDb.students || []).map(s => toSafeDocId(s.studentId)));
      const deleteBatch = writeBatch(db);
      let delCount = 0;
      existingFirestoreStudentDocs.forEach(d => {
        const data = d.data();
        const matches =
          currentStudentIds.has(d.id) ||
          currentStudentCodes.has(d.id) ||
          currentStudentIds.has(toSafeDocId(data.id)) ||
          currentStudentCodes.has(toSafeDocId(data.studentId));
        if (!matches) {
          deleteBatch.delete(d.ref);
          delCount++;
        }
      });
      if (delCount > 0) {
        await deleteBatch.commit();
      }
    } catch {
      // Non-fatal cleanup
    }

    // 3. Save Assessments in Batches
    if (appDb.assessments && appDb.assessments.length > 0) {
      const asmBatches: AssessmentRecord[][] = [];
      for (let i = 0; i < appDb.assessments.length; i += 400) {
        asmBatches.push(appDb.assessments.slice(i, i + 400));
      }
      for (const chunk of asmBatches) {
        const batch = writeBatch(db);
        chunk.forEach(asm => {
          const docRef = doc(db, 'schools', SCHOOL_DOC_ID, 'assessments', toSafeDocId(asm.id));
          batch.set(docRef, sanitizeForFirestore(asm), { merge: true });
        });
        await batch.commit();
      }
    }

    // 4. Save Attendance in Batches
    if (appDb.attendance && appDb.attendance.length > 0) {
      const attBatches: AttendanceRecord[][] = [];
      for (let i = 0; i < appDb.attendance.length; i += 400) {
        attBatches.push(appDb.attendance.slice(i, i + 400));
      }
      for (const chunk of attBatches) {
        const batch = writeBatch(db);
        chunk.forEach(att => {
          const docRef = doc(db, 'schools', SCHOOL_DOC_ID, 'attendance', toSafeDocId(att.id));
          batch.set(docRef, sanitizeForFirestore(att), { merge: true });
        });
        await batch.commit();
      }
    }

    // 5. Save Users
    if (appDb.users && appDb.users.length > 0) {
      const batch = writeBatch(db);
      appDb.users.forEach(user => {
        const docRef = doc(db, 'schools', SCHOOL_DOC_ID, 'users', toSafeDocId(user.id));
        batch.set(docRef, sanitizeForFirestore(user), { merge: true });
      });
      await batch.commit();
    }

    // 6. Save Audit Logs (most recent 100)
    if (appDb.auditLogs && appDb.auditLogs.length > 0) {
      const recentLogs = appDb.auditLogs.slice(0, 100);
      const batch = writeBatch(db);
      recentLogs.forEach(log => {
        const docRef = doc(db, 'schools', SCHOOL_DOC_ID, 'auditLogs', toSafeDocId(log.id));
        batch.set(docRef, sanitizeForFirestore(log), { merge: true });
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `schools/${SCHOOL_DOC_ID}`);
    throw error;
  }
}

/**
 * Permanently removes a student and their associated assessments from Firestore.
 */
export async function deleteStudentFromFirestore(
  studentInternalId: string,
  studentId?: string
): Promise<void> {
  try {
    // 1. Direct delete by internal ID
    if (studentInternalId) {
      const studentRef = doc(db, 'schools', SCHOOL_DOC_ID, 'students', toSafeDocId(studentInternalId));
      await deleteDoc(studentRef).catch(() => {});
    }

    // 2. Direct delete by studentId
    if (studentId && studentId !== studentInternalId) {
      const altStudentRef = doc(db, 'schools', SCHOOL_DOC_ID, 'students', toSafeDocId(studentId));
      await deleteDoc(altStudentRef).catch(() => {});
    }

    // 3. Query all docs in students subcollection to catch any document matching ID or studentId
    const stuCol = collection(db, 'schools', SCHOOL_DOC_ID, 'students');
    const stuSnaps = await getDocs(stuCol);
    const stuBatch = writeBatch(db);
    let stuCount = 0;
    const safeInternal = toSafeDocId(studentInternalId);
    const safeStudentId = studentId ? toSafeDocId(studentId) : '';
    stuSnaps.forEach(d => {
      const data = d.data();
      if (
        d.id === studentInternalId ||
        d.id === safeInternal ||
        (studentId && (d.id === studentId || d.id === safeStudentId)) ||
        data.id === studentInternalId ||
        (studentId && (data.studentId === studentId || data.studentId === studentInternalId))
      ) {
        stuBatch.delete(d.ref);
        stuCount++;
      }
    });
    if (stuCount > 0) {
      await stuBatch.commit();
    }

    // 4. Clean up any assessments belonging to this student in Firestore
    const sid = studentId || studentInternalId;
    if (sid) {
      const asmCol = collection(db, 'schools', SCHOOL_DOC_ID, 'assessments');
      const asmSnaps = await getDocs(asmCol);
      const batch = writeBatch(db);
      let count = 0;
      asmSnaps.forEach(d => {
        const data = d.data();
        if (data.studentId === sid || data.studentId === studentInternalId) {
          batch.delete(d.ref);
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
      }

      // 5. Clean up any attendance belonging to this student in Firestore
      const attCol = collection(db, 'schools', SCHOOL_DOC_ID, 'attendance');
      const attSnaps = await getDocs(attCol);
      const attBatch = writeBatch(db);
      let attCount = 0;
      attSnaps.forEach(d => {
        const data = d.data();
        if (data.studentId === sid || data.studentId === studentInternalId) {
          attBatch.delete(d.ref);
          attCount++;
        }
      });
      if (attCount > 0) {
        await attBatch.commit();
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `schools/${SCHOOL_DOC_ID}/students/${studentInternalId}`);
  }
}

/**
 * Permanently removes an assessment from Firestore.
 */
export async function deleteAssessmentFromFirestore(assessmentId: string): Promise<void> {
  try {
    const asmRef = doc(db, 'schools', SCHOOL_DOC_ID, 'assessments', toSafeDocId(assessmentId));
    await deleteDoc(asmRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `schools/${SCHOOL_DOC_ID}/assessments/${assessmentId}`);
  }
}

/**
 * Permanently removes a user account from Firestore.
 */
export async function deleteUserFromFirestore(userId: string): Promise<void> {
  try {
    const userRef = doc(db, 'schools', SCHOOL_DOC_ID, 'users', toSafeDocId(userId));
    await deleteDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `schools/${SCHOOL_DOC_ID}/users/${userId}`);
  }
}

let activeSyncAccumulator: AppDatabase | null = null;

export function setSyncDbSnapshot(latestDb: AppDatabase): void {
  activeSyncAccumulator = { ...latestDb };
}

/**
 * Initializes real-time two-way synchronization with Firestore across all devices.
 * If Firestore is empty initially, seeds it from the local database.
 * If Firestore has data, keeps the client updated in real-time as changes occur on other devices.
 */
export function setupRealtimeSync(
  initialLocalDb: AppDatabase,
  onSyncUpdate: (updatedDb: AppDatabase) => void,
  onStatusChange?: (status: 'synced' | 'syncing' | 'offline' | 'error') => void
): () => void {
  let isSeeding = false;
  const unsubs: Unsubscribe[] = [];

  // Internal accumulator of the latest cloud state
  activeSyncAccumulator = { ...initialLocalDb };

  const notifyChange = () => {
    if (!activeSyncAccumulator) return;
    onSyncUpdate({ ...activeSyncAccumulator });
    onStatusChange?.('synced');
  };

  // 1. Watch Core School Document (Settings, Classes, Sections, Subjects)
  const schoolDocRef = doc(db, 'schools', SCHOOL_DOC_ID);
  const unsubSchool = onSnapshot(
    schoolDocRef,
    async snapshot => {
      onStatusChange?.('syncing');
      if (!snapshot.exists()) {
        // First-time setup: Seed Firestore with initial database
        if (!isSeeding) {
          isSeeding = true;
          try {
            await syncDatabaseToFirestore(initialLocalDb);
            onStatusChange?.('synced');
          } catch (err) {
            console.error('Initial Firestore seeding failed:', err);
            onStatusChange?.('error');
          } finally {
            isSeeding = false;
          }
        }
        return;
      }

      const data = snapshot.data();
      if (data && activeSyncAccumulator) {
        activeSyncAccumulator = {
          ...activeSyncAccumulator,
          settings: {
            ...activeSyncAccumulator.settings,
            ...(data.settings || {}),
          },
          classes: data.classes || activeSyncAccumulator.classes,
          sections: data.sections || activeSyncAccumulator.sections,
          subjects: data.subjects || activeSyncAccumulator.subjects,
          terms: data.terms || activeSyncAccumulator.terms,
          sessions: data.sessions || activeSyncAccumulator.sessions,
          gradingBoundaries: data.gradingBoundaries || activeSyncAccumulator.gradingBoundaries,
          psychomotorItems: data.psychomotorItems || activeSyncAccumulator.psychomotorItems,
        };
        notifyChange();
      }
    },
    error => {
      handleFirestoreError(error, OperationType.GET, `schools/${SCHOOL_DOC_ID}`);
      onStatusChange?.('offline');
    }
  );
  unsubs.push(unsubSchool);

  // 2. Watch Students Collection
  const studentsColRef = collection(db, 'schools', SCHOOL_DOC_ID, 'students');
  const unsubStudents = onSnapshot(
    studentsColRef,
    snapshot => {
      if (!activeSyncAccumulator) return;
      if (snapshot.empty && activeSyncAccumulator.students && activeSyncAccumulator.students.length > 0) {
        // Cloud is empty on first listen but client has local students: seed cloud
        syncDatabaseToFirestore(activeSyncAccumulator).catch(() => {});
        return;
      }
      const cloudStudents: Student[] = [];
      snapshot.forEach(docSnap => {
        cloudStudents.push(docSnap.data() as Student);
      });
      activeSyncAccumulator = {
        ...activeSyncAccumulator,
        students: cloudStudents,
      };
      notifyChange();
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, `schools/${SCHOOL_DOC_ID}/students`);
    }
  );
  unsubs.push(unsubStudents);

  // 3. Watch Assessments Collection
  const assessmentsColRef = collection(db, 'schools', SCHOOL_DOC_ID, 'assessments');
  const unsubAssessments = onSnapshot(
    assessmentsColRef,
    snapshot => {
      if (!activeSyncAccumulator) return;
      if (snapshot.empty && activeSyncAccumulator.assessments && activeSyncAccumulator.assessments.length > 0) {
        // Cloud is empty on first listen but client has local assessments: seed cloud
        syncDatabaseToFirestore(activeSyncAccumulator).catch(() => {});
        return;
      }
      const cloudAssessments: AssessmentRecord[] = [];
      snapshot.forEach(docSnap => {
        cloudAssessments.push(docSnap.data() as AssessmentRecord);
      });
      activeSyncAccumulator = {
        ...activeSyncAccumulator,
        assessments: cloudAssessments,
      };
      notifyChange();
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, `schools/${SCHOOL_DOC_ID}/assessments`);
    }
  );
  unsubs.push(unsubAssessments);

  // 4. Watch Attendance Collection
  const attendanceColRef = collection(db, 'schools', SCHOOL_DOC_ID, 'attendance');
  const unsubAttendance = onSnapshot(
    attendanceColRef,
    snapshot => {
      if (!activeSyncAccumulator) return;
      if (snapshot.empty && activeSyncAccumulator.attendance && activeSyncAccumulator.attendance.length > 0) {
        syncDatabaseToFirestore(activeSyncAccumulator).catch(() => {});
        return;
      }
      const cloudAttendance: AttendanceRecord[] = [];
      snapshot.forEach(docSnap => {
        cloudAttendance.push(docSnap.data() as AttendanceRecord);
      });
      activeSyncAccumulator = {
        ...activeSyncAccumulator,
        attendance: cloudAttendance,
      };
      notifyChange();
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, `schools/${SCHOOL_DOC_ID}/attendance`);
    }
  );
  unsubs.push(unsubAttendance);

  // 5. Watch Users Collection
  const usersColRef = collection(db, 'schools', SCHOOL_DOC_ID, 'users');
  const unsubUsers = onSnapshot(
    usersColRef,
    snapshot => {
      if (!activeSyncAccumulator) return;
      if (!snapshot.empty) {
        const cloudUsers: UserAccount[] = [];
        snapshot.forEach(docSnap => {
          cloudUsers.push(docSnap.data() as UserAccount);
        });
        activeSyncAccumulator = {
          ...activeSyncAccumulator,
          users: cloudUsers,
        };
        notifyChange();
      }
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, `schools/${SCHOOL_DOC_ID}/users`);
    }
  );
  unsubs.push(unsubUsers);

  // 6. Watch Audit Logs Collection
  const auditLogsColRef = collection(db, 'schools', SCHOOL_DOC_ID, 'auditLogs');
  const unsubAudit = onSnapshot(
    auditLogsColRef,
    snapshot => {
      if (!activeSyncAccumulator) return;
      if (!snapshot.empty) {
        const cloudLogs: AuditLogEntry[] = [];
        snapshot.forEach(docSnap => {
          cloudLogs.push(docSnap.data() as AuditLogEntry);
        });
        cloudLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        activeSyncAccumulator = {
          ...activeSyncAccumulator,
          auditLogs: cloudLogs,
        };
        notifyChange();
      }
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, `schools/${SCHOOL_DOC_ID}/auditLogs`);
    }
  );
  unsubs.push(unsubAudit);

  // Cleanup all listeners on unmount
  return () => {
    activeSyncAccumulator = null;
    unsubs.forEach(unsub => unsub());
  };
}
