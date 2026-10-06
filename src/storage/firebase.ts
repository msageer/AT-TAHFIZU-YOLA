import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
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
          const docRef = doc(db, 'schools', SCHOOL_DOC_ID, 'students', student.id);
          batch.set(docRef, sanitizeForFirestore(student), { merge: true });
        });
        await batch.commit();
      }
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
          const docRef = doc(db, 'schools', SCHOOL_DOC_ID, 'assessments', asm.id);
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
          const docRef = doc(db, 'schools', SCHOOL_DOC_ID, 'attendance', att.id);
          batch.set(docRef, sanitizeForFirestore(att), { merge: true });
        });
        await batch.commit();
      }
    }

    // 5. Save Users
    if (appDb.users && appDb.users.length > 0) {
      const batch = writeBatch(db);
      appDb.users.forEach(user => {
        const docRef = doc(db, 'schools', SCHOOL_DOC_ID, 'users', user.id);
        batch.set(docRef, sanitizeForFirestore(user), { merge: true });
      });
      await batch.commit();
    }

    // 6. Save Audit Logs (most recent 100)
    if (appDb.auditLogs && appDb.auditLogs.length > 0) {
      const recentLogs = appDb.auditLogs.slice(0, 100);
      const batch = writeBatch(db);
      recentLogs.forEach(log => {
        const docRef = doc(db, 'schools', SCHOOL_DOC_ID, 'auditLogs', log.id);
        batch.set(docRef, sanitizeForFirestore(log), { merge: true });
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `schools/${SCHOOL_DOC_ID}`);
  }
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
  let currentCloudDb: AppDatabase = { ...initialLocalDb };

  const notifyChange = () => {
    onSyncUpdate({ ...currentCloudDb });
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
      if (data) {
        currentCloudDb = {
          ...currentCloudDb,
          settings: {
            ...currentCloudDb.settings,
            ...(data.settings || {}),
          },
          classes: data.classes || currentCloudDb.classes,
          sections: data.sections || currentCloudDb.sections,
          subjects: data.subjects || currentCloudDb.subjects,
          terms: data.terms || currentCloudDb.terms,
          sessions: data.sessions || currentCloudDb.sessions,
          gradingBoundaries: data.gradingBoundaries || currentCloudDb.gradingBoundaries,
          psychomotorItems: data.psychomotorItems || currentCloudDb.psychomotorItems,
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
      if (!snapshot.empty) {
        const cloudStudents: Student[] = [];
        snapshot.forEach(docSnap => {
          cloudStudents.push(docSnap.data() as Student);
        });
        currentCloudDb = {
          ...currentCloudDb,
          students: cloudStudents,
        };
        notifyChange();
      }
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
      if (!snapshot.empty) {
        const cloudAssessments: AssessmentRecord[] = [];
        snapshot.forEach(docSnap => {
          cloudAssessments.push(docSnap.data() as AssessmentRecord);
        });
        currentCloudDb = {
          ...currentCloudDb,
          assessments: cloudAssessments,
        };
        notifyChange();
      }
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
      if (!snapshot.empty) {
        const cloudAttendance: AttendanceRecord[] = [];
        snapshot.forEach(docSnap => {
          cloudAttendance.push(docSnap.data() as AttendanceRecord);
        });
        currentCloudDb = {
          ...currentCloudDb,
          attendance: cloudAttendance,
        };
        notifyChange();
      }
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
      if (!snapshot.empty) {
        const cloudUsers: UserAccount[] = [];
        snapshot.forEach(docSnap => {
          cloudUsers.push(docSnap.data() as UserAccount);
        });
        currentCloudDb = {
          ...currentCloudDb,
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
      if (!snapshot.empty) {
        const cloudLogs: AuditLogEntry[] = [];
        snapshot.forEach(docSnap => {
          cloudLogs.push(docSnap.data() as AuditLogEntry);
        });
        cloudLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        currentCloudDb = {
          ...currentCloudDb,
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
    unsubs.forEach(unsub => unsub());
  };
}
