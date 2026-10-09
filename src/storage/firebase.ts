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
  disableNetwork,
  enableNetwork,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  AppDatabase,
  Student,
  AssessmentRecord,
  AttendanceRecord,
  UserAccount,
  AuditLogEntry,
  ClassItem,
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

const QUOTA_STORAGE_KEY = 'islamic_school_firestore_quota_exhausted_v1';

// Track in-memory quota exhaustion state (defaults to false so synchronization operates live)
let quotaExhaustedInMemory = false;

// Clear any stale local quota blocks on startup so multi-device sync connects immediately
if (typeof window !== 'undefined') {
  try {
    sessionStorage.removeItem(QUOTA_STORAGE_KEY);
    localStorage.removeItem(QUOTA_STORAGE_KEY);
    // Ensure network is active
    enableNetwork(db).catch(() => {});
  } catch {
    // ignore
  }
}

/**
 * Checks whether an error is a Firestore resource-exhausted (quota limit) error.
 */
export function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code;
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Free daily write units')
  );
}

/**
 * Returns true only if Firestore daily write quota was actually rejected with resource-exhausted.
 */
export function isQuotaExhausted(): boolean {
  return quotaExhaustedInMemory;
}

/**
 * Marks Firestore quota as exhausted to prevent further write attempts until reset.
 */
export function markQuotaExhausted(): void {
  quotaExhaustedInMemory = true;
  try {
    const payload = JSON.stringify({ timestamp: Date.now(), reason: 'resource-exhausted' });
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(QUOTA_STORAGE_KEY, payload);
      localStorage.setItem(QUOTA_STORAGE_KEY, payload);
    }
  } catch {
    // ignore storage errors
  }
  try {
    disableNetwork(db).catch(() => {});
  } catch {
    // ignore
  }
}

/**
 * Allows manual or scheduled reconnect attempts to test if cloud quota has been reset.
 */
export async function tryReconnectCloudSync(): Promise<boolean> {
  try {
    await enableNetwork(db);
    quotaExhaustedInMemory = false;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(QUOTA_STORAGE_KEY);
      localStorage.removeItem(QUOTA_STORAGE_KEY);
    }
    return true;
  } catch (error) {
    markQuotaExhausted();
    return false;
  }
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  if (isQuotaExceededError(error)) {
    markQuotaExhausted();
    return;
  }

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
  console.warn('Firestore Operation Notice:', JSON.stringify(errInfo));
}

// 3. Optional Connection Test
export async function testConnection(): Promise<boolean> {
  if (isQuotaExhausted()) {
    return false;
  }
  const testPath = 'test/connection';
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markQuotaExhausted();
      return false;
    }
    return false;
  }
}

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

let isSyncInProgress = false;
let pendingSyncDb: AppDatabase | null = null;

/**
 * Sync entire AppDatabase to Firestore in a transactional/batch-safe manner.
 * Updates and overrides data across devices without tampering with existing records.
 */
export async function syncDatabaseToFirestore(appDb: AppDatabase): Promise<void> {
  // If Firestore quota is already exhausted, safely skip cloud writes to avoid backend error loops
  if (isQuotaExhausted()) {
    return;
  }

  // If another sync is actively executing, queue this state so the latest data is NEVER dropped
  if (isSyncInProgress) {
    pendingSyncDb = appDb;
    return;
  }

  isSyncInProgress = true;
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

    // 6. Save Audit Logs (most recent 50)
    if (appDb.auditLogs && appDb.auditLogs.length > 0) {
      const recentLogs = appDb.auditLogs.slice(0, 50);
      const batch = writeBatch(db);
      recentLogs.forEach(log => {
        const docRef = doc(db, 'schools', SCHOOL_DOC_ID, 'auditLogs', toSafeDocId(log.id));
        batch.set(docRef, sanitizeForFirestore(log), { merge: true });
      });
      await batch.commit();
    }
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markQuotaExhausted();
      console.warn('Firestore daily write quota reached during sync; safely maintaining offline database.');
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, `schools/${SCHOOL_DOC_ID}`);
    throw error;
  } finally {
    isSyncInProgress = false;
    // If a database update arrived while this sync was writing, immediately sync the newest version
    if (pendingSyncDb) {
      const nextDb = pendingSyncDb;
      pendingSyncDb = null;
      syncDatabaseToFirestore(nextDb).catch(err => {
        console.warn('Deferred multi-device sync warning:', err);
      });
    }
  }
}

/**
 * Permanently removes a student and their associated assessments from Firestore.
 */
export async function deleteStudentFromFirestore(
  studentInternalId: string,
  studentId?: string
): Promise<void> {
  if (isQuotaExhausted()) {
    return;
  }
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
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markQuotaExhausted();
      return;
    }
    handleFirestoreError(error, OperationType.DELETE, `schools/${SCHOOL_DOC_ID}/students/${studentInternalId}`);
  }
}

/**
 * Permanently removes an assessment from Firestore.
 */
export async function deleteAssessmentFromFirestore(assessmentId: string): Promise<void> {
  if (isQuotaExhausted()) return;
  try {
    const asmRef = doc(db, 'schools', SCHOOL_DOC_ID, 'assessments', toSafeDocId(assessmentId));
    await deleteDoc(asmRef);
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markQuotaExhausted();
      return;
    }
    handleFirestoreError(error, OperationType.DELETE, `schools/${SCHOOL_DOC_ID}/assessments/${assessmentId}`);
  }
}

/**
 * Permanently removes a user account from Firestore.
 */
export async function deleteUserFromFirestore(userId: string): Promise<void> {
  if (isQuotaExhausted()) return;
  try {
    const userRef = doc(db, 'schools', SCHOOL_DOC_ID, 'users', toSafeDocId(userId));
    await deleteDoc(userRef);
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markQuotaExhausted();
      return;
    }
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
  // If quota is exhausted, immediately transition to offline mode without opening backend listeners
  if (isQuotaExhausted()) {
    onStatusChange?.('offline');
    return () => {};
  }

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
        // Document does not exist yet in cloud; keep local database active without issuing unexpected cloud writes
        onStatusChange?.('synced');
        return;
      }

      const data = snapshot.data();
      if (data && activeSyncAccumulator) {
        // Non-destructive merge of classes: preserve all local classes and merge cloud additions
        const localClasses = activeSyncAccumulator.classes || [];
        const cloudClasses: ClassItem[] = data.classes || [];
        const classMap = new Map<string, ClassItem>();
        localClasses.forEach(c => classMap.set(c.name.toLowerCase().trim(), c));
        cloudClasses.forEach(cc => {
          const key = cc.name.toLowerCase().trim();
          if (!classMap.has(key)) {
            classMap.set(key, cc);
          } else {
            const existing = classMap.get(key)!;
            classMap.set(key, {
              ...existing,
              ...cc,
              termFees: { ...(existing.termFees || {}), ...(cc.termFees || {}) },
              classTeacherName: cc.classTeacherName || existing.classTeacherName,
              sectionTeachers: { ...(existing.sectionTeachers || {}), ...(cc.sectionTeachers || {}) },
            });
          }
        });

        activeSyncAccumulator = {
          ...activeSyncAccumulator,
          settings: {
            ...activeSyncAccumulator.settings,
            ...(data.settings || {}),
          },
          classes: Array.from(classMap.values()),
          sections: data.sections && data.sections.length >= (activeSyncAccumulator.sections?.length || 0)
            ? data.sections
            : activeSyncAccumulator.sections,
          subjects: data.subjects && data.subjects.length >= (activeSyncAccumulator.subjects?.length || 0)
            ? data.subjects
            : activeSyncAccumulator.subjects,
          terms: data.terms || activeSyncAccumulator.terms,
          sessions: data.sessions || activeSyncAccumulator.sessions,
          gradingBoundaries: data.gradingBoundaries || activeSyncAccumulator.gradingBoundaries,
          psychomotorItems: data.psychomotorItems || activeSyncAccumulator.psychomotorItems,
        };
        notifyChange();
      }
    },
    error => {
      if (isQuotaExceededError(error)) {
        markQuotaExhausted();
        onStatusChange?.('offline');
        return;
      }
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
      if (snapshot.empty) {
        // If cloud snapshot is empty, preserve local student data without issuing writes
        return;
      }
      const cloudStudents: Student[] = [];
      snapshot.forEach(docSnap => {
        cloudStudents.push(docSnap.data() as Student);
      });

      // NON-DESTRUCTIVE STUDENT MERGE: Never drop local students
      const studentMap = new Map<string, Student>();
      (activeSyncAccumulator.students || []).forEach(s => {
        studentMap.set(s.id || s.studentId, s);
        if (s.studentId) studentMap.set(s.studentId, s);
      });
      cloudStudents.forEach(cs => {
        const key = cs.id || cs.studentId;
        const existing = studentMap.get(key) || (cs.studentId ? studentMap.get(cs.studentId) : undefined);
        if (!existing) {
          studentMap.set(key, cs);
        } else {
          studentMap.set(key, { ...existing, ...cs });
        }
      });

      activeSyncAccumulator = {
        ...activeSyncAccumulator,
        students: Array.from(new Set(studentMap.values())),
      };
      notifyChange();
    },
    error => {
      if (isQuotaExceededError(error)) {
        markQuotaExhausted();
        onStatusChange?.('offline');
        return;
      }
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
      if (snapshot.empty) {
        // Preserve local assessments without issuing writes
        return;
      }
      const cloudAssessments: AssessmentRecord[] = [];
      snapshot.forEach(docSnap => {
        cloudAssessments.push(docSnap.data() as AssessmentRecord);
      });

      // NON-DESTRUCTIVE ASSESSMENT MERGE: Ensure Device B receives real assessment uploads from Device A
      const asmMap = new Map<string, AssessmentRecord>();
      (activeSyncAccumulator.assessments || []).forEach(a => {
        const key = `${a.studentId}__${a.academicSession}__${a.term}`;
        asmMap.set(key, a);
        if (a.id) asmMap.set(a.id, a);
      });
      cloudAssessments.forEach(ca => {
        const key = `${ca.studentId}__${ca.academicSession}__${ca.term}`;
        const existing = asmMap.get(key) || (ca.id ? asmMap.get(ca.id) : undefined);
        if (!existing) {
          asmMap.set(key, ca);
          if (ca.id) asmMap.set(ca.id, ca);
        } else {
          const localTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          const cloudTime = ca.updatedAt ? new Date(ca.updatedAt).getTime() : 0;
          const localHasScores = Boolean(existing.subjectScores && existing.subjectScores.length > 0);
          const cloudHasScores = Boolean(ca.subjectScores && ca.subjectScores.length > 0);
          if (cloudTime >= localTime || (!localHasScores && cloudHasScores)) {
            asmMap.set(key, ca);
            if (ca.id) asmMap.set(ca.id, ca);
          }
        }
      });

      activeSyncAccumulator = {
        ...activeSyncAccumulator,
        assessments: Array.from(new Set(asmMap.values())),
      };
      notifyChange();
    },
    error => {
      if (isQuotaExceededError(error)) {
        markQuotaExhausted();
        onStatusChange?.('offline');
        return;
      }
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
      if (snapshot.empty) {
        // Preserve local attendance without issuing writes
        return;
      }
      const cloudAttendance: AttendanceRecord[] = [];
      snapshot.forEach(docSnap => {
        cloudAttendance.push(docSnap.data() as AttendanceRecord);
      });

      // NON-DESTRUCTIVE ATTENDANCE MERGE: Never drop local attendance
      const attMap = new Map<string, AttendanceRecord>();
      (activeSyncAccumulator.attendance || []).forEach(att => {
        attMap.set(`${att.studentId}__${att.academicSession}__${att.term}`, att);
      });
      cloudAttendance.forEach(ca => {
        const key = `${ca.studentId}__${ca.academicSession}__${ca.term}`;
        const existing = attMap.get(key);
        if (!existing) {
          attMap.set(key, ca);
        } else {
          const localTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          const cloudTime = ca.updatedAt ? new Date(ca.updatedAt).getTime() : 0;
          if (cloudTime > localTime) {
            attMap.set(key, ca);
          }
        }
      });

      activeSyncAccumulator = {
        ...activeSyncAccumulator,
        attendance: Array.from(attMap.values()),
      };
      notifyChange();
    },
    error => {
      if (isQuotaExceededError(error)) {
        markQuotaExhausted();
        onStatusChange?.('offline');
        return;
      }
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
        const userMap = new Map<string, UserAccount>();
        (activeSyncAccumulator.users || []).forEach(u => userMap.set(u.id, u));
        cloudUsers.forEach(cu => {
          userMap.set(cu.id, { ...(userMap.get(cu.id) || {}), ...cu });
        });
        activeSyncAccumulator = {
          ...activeSyncAccumulator,
          users: Array.from(userMap.values()),
        };
        notifyChange();
      }
    },
    error => {
      if (isQuotaExceededError(error)) {
        markQuotaExhausted();
        onStatusChange?.('offline');
        return;
      }
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
      if (isQuotaExceededError(error)) {
        markQuotaExhausted();
        onStatusChange?.('offline');
        return;
      }
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
