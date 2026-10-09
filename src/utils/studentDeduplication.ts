import { Student, AssessmentRecord, AttendanceRecord } from '../types';

/**
 * Normalizes a student's name for robust duplicate detection.
 * Removes extra whitespace, trims, and converts to lowercase.
 */
export function normalizeStudentName(name?: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[\.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes an identifier string (Student ID or Admission Number).
 */
export function normalizeIdentifier(id?: string): string {
  if (!id) return '';
  return id.toLowerCase().replace(/[\s\-_]/g, '').trim();
}

export interface DuplicateStudentGroup {
  key: string;
  reason: 'STUDENT_ID' | 'ADMISSION_NUMBER' | 'NAME_AND_CLASS';
  students: Student[];
}

/**
 * Scans a student array and groups any duplicates together based on:
 * 1. Matching Student ID
 * 2. Matching Admission Number
 * 3. Matching Normalized Name + Class Name
 */
export function findDuplicateStudentGroups(students: Student[]): DuplicateStudentGroup[] {
  if (!students || students.length <= 1) return [];

  const groups: DuplicateStudentGroup[] = [];
  const processedIds = new Set<string>();

  // 1. Group by Student ID
  const idMap = new Map<string, Student[]>();
  students.forEach(s => {
    const norm = normalizeIdentifier(s.studentId);
    if (norm) {
      const list = idMap.get(norm) || [];
      list.push(s);
      idMap.set(norm, list);
    }
  });

  idMap.forEach((matched, normId) => {
    if (matched.length > 1) {
      groups.push({
        key: `id:${normId}`,
        reason: 'STUDENT_ID',
        students: matched,
      });
      matched.forEach(s => processedIds.add(s.id));
    }
  });

  // 2. Group by Admission Number (excluding already grouped students)
  const admMap = new Map<string, Student[]>();
  students.forEach(s => {
    const normAdm = normalizeIdentifier(s.admissionNumber);
    if (normAdm) {
      const list = admMap.get(normAdm) || [];
      list.push(s);
      admMap.set(normAdm, list);
    }
  });

  admMap.forEach((matched, normAdm) => {
    if (matched.length > 1) {
      // Check if this isn't already identical to an existing group
      const alreadyCovered = matched.every(s => processedIds.has(s.id));
      if (!alreadyCovered) {
        groups.push({
          key: `adm:${normAdm}`,
          reason: 'ADMISSION_NUMBER',
          students: matched,
        });
        matched.forEach(s => processedIds.add(s.id));
      }
    }
  });

  // 3. Group by Name + Class Name
  const nameClassMap = new Map<string, Student[]>();
  students.forEach(s => {
    const normName = normalizeStudentName(s.name);
    const normClass = (s.className || '').toLowerCase().trim();
    if (normName && normClass) {
      const key = `${normName}__${normClass}`;
      const list = nameClassMap.get(key) || [];
      list.push(s);
      nameClassMap.set(key, list);
    }
  });

  nameClassMap.forEach((matched, key) => {
    if (matched.length > 1) {
      const alreadyCovered = matched.every(s => processedIds.has(s.id));
      if (!alreadyCovered) {
        groups.push({
          key: `name:${key}`,
          reason: 'NAME_AND_CLASS',
          students: matched,
        });
        matched.forEach(s => processedIds.add(s.id));
      }
    }
  });

  return groups;
}

export interface DeduplicationResult {
  deduplicatedStudents: Student[];
  remappedAssessments: AssessmentRecord[];
  remappedAttendance: AttendanceRecord[];
  removedStudentDocIds: string[];
  duplicateGroupCount: number;
  removedStudentCount: number;
}

/**
 * Deduplicates the student directory by consolidating all duplicate entries into one canonical record per student.
 * - Leaves exactly ONE student per unique student.
 * - Merges student details, contact info, and academic histories non-destructively.
 * - Remaps assessment records and attendance records to the canonical student ID.
 * - Collects the document IDs of duplicate records to remove from persistent cloud storage.
 */
export function deduplicateStudents(
  students: Student[],
  assessments: AssessmentRecord[] = [],
  attendance: AttendanceRecord[] = []
): DeduplicationResult {
  if (!students || students.length === 0) {
    return {
      deduplicatedStudents: [],
      remappedAssessments: assessments,
      remappedAttendance: attendance,
      removedStudentDocIds: [],
      duplicateGroupCount: 0,
      removedStudentCount: 0,
    };
  }

  // Multi-index mapping to identify duplicate identities
  const canonicalStudents: Student[] = [];
  const removedDocIds: string[] = [];

  // Mappings to track which alternate IDs map to which canonical student ID
  const idRedirectionMap = new Map<string, string>(); // alternateId -> canonicalStudentId

  students.forEach(candidate => {
    const normId = normalizeIdentifier(candidate.studentId);
    const normAdm = normalizeIdentifier(candidate.admissionNumber);
    const normName = normalizeStudentName(candidate.name);
    const normClass = (candidate.className || '').toLowerCase().trim();

    // Check if we have already registered a canonical student for this identity
    const existingIndex = canonicalStudents.findIndex(cs => {
      // 1. Same internal ID
      if (cs.id === candidate.id) return true;
      // 2. Same student ID
      if (normId && normalizeIdentifier(cs.studentId) === normId) return true;
      // 3. Same admission number
      if (normAdm && normalizeIdentifier(cs.admissionNumber) === normAdm) return true;
      // 4. Same Name and Class
      if (
        normName &&
        normClass &&
        normalizeStudentName(cs.name) === normName &&
        (cs.className || '').toLowerCase().trim() === normClass
      ) {
        return true;
      }
      return false;
    });

    if (existingIndex >= 0) {
      // DUPLICATE DETECTED: Merge into existing canonical record!
      const existing = canonicalStudents[existingIndex];

      // Mark candidate's IDs to redirect to existing canonical student
      idRedirectionMap.set(candidate.id, existing.studentId);
      if (candidate.studentId) idRedirectionMap.set(candidate.studentId, existing.studentId);
      if (candidate.admissionNumber) idRedirectionMap.set(candidate.admissionNumber, existing.studentId);

      // Record this duplicate document ID for removal
      removedDocIds.push(candidate.id);

      // Consolidate fields: fill in any missing information from candidate
      const mergedHistories = [
        ...(existing.academicHistory || []),
        ...(candidate.academicHistory || []),
      ];
      // Deduplicate history entries by session + term
      const uniqueHistoryMap = new Map<string, any>();
      mergedHistories.forEach(h => {
        const hKey = `${h.session || ''}__${h.term || ''}`;
        if (!uniqueHistoryMap.has(hKey)) {
          uniqueHistoryMap.set(hKey, h);
        }
      });

      canonicalStudents[existingIndex] = {
        ...existing,
        name: existing.name || candidate.name,
        className: existing.className || candidate.className,
        section: existing.section || candidate.section || '',
        gender: existing.gender || candidate.gender || 'Male',
        parentName: existing.parentName || candidate.parentName,
        parentPhone: existing.parentPhone || candidate.parentPhone,
        address: existing.address || candidate.address,
        dateOfBirth: existing.dateOfBirth || candidate.dateOfBirth,
        admissionDate: existing.admissionDate || candidate.admissionDate,
        admissionNumber: existing.admissionNumber || candidate.admissionNumber,
        studentId: existing.studentId || candidate.studentId,
        status: existing.status === 'Active' ? 'Active' : (candidate.status || existing.status),
        academicHistory: Array.from(uniqueHistoryMap.values()),
      };
    } else {
      // First time seeing this student: record as canonical
      canonicalStudents.push({ ...candidate });
    }
  });

  // Remap and deduplicate assessment records
  const remappedAssessmentsMap = new Map<string, AssessmentRecord>();
  assessments.forEach(asm => {
    const targetStudentId = idRedirectionMap.get(asm.studentId) || asm.studentId;
    const remappedRecord: AssessmentRecord = {
      ...asm,
      studentId: targetStudentId,
    };

    const key = `${targetStudentId}__${remappedRecord.academicSession}__${remappedRecord.term}`;
    const existingAsm = remappedAssessmentsMap.get(key);

    if (!existingAsm) {
      remappedAssessmentsMap.set(key, remappedRecord);
    } else {
      // Merge subject scores if existing had fewer scores
      const existingScoresCount = existingAsm.subjectScores?.length || 0;
      const newScoresCount = remappedRecord.subjectScores?.length || 0;
      if (newScoresCount > existingScoresCount) {
        remappedAssessmentsMap.set(key, remappedRecord);
      }
    }
  });

  // Remap and deduplicate attendance records
  const remappedAttendanceMap = new Map<string, AttendanceRecord>();
  attendance.forEach(att => {
    const targetStudentId = idRedirectionMap.get(att.studentId) || att.studentId;
    const key = `${targetStudentId}__${att.academicSession}__${att.term}`;
    if (!remappedAttendanceMap.has(key)) {
      remappedAttendanceMap.set(key, { ...att, studentId: targetStudentId });
    }
  });

  const duplicateGroups = findDuplicateStudentGroups(students);

  return {
    deduplicatedStudents: canonicalStudents,
    remappedAssessments: Array.from(remappedAssessmentsMap.values()),
    remappedAttendance: Array.from(remappedAttendanceMap.values()),
    removedStudentDocIds: removedDocIds,
    duplicateGroupCount: duplicateGroups.length,
    removedStudentCount: students.length - canonicalStudents.length,
  };
}

/**
 * Safe single student saver: checks if a student already exists (by ID, admission number, or name + class).
 * If exists, OVERRIDES and updates that student record rather than creating a duplicate.
 * If not exists, adds the student.
 */
export function saveStudentWithoutDuplicates(
  studentList: Student[],
  newStudent: Student
): { updatedList: Student[]; wasOverwritten: boolean } {
  const normId = normalizeIdentifier(newStudent.studentId);
  const normAdm = normalizeIdentifier(newStudent.admissionNumber);
  const normName = normalizeStudentName(newStudent.name);
  const normClass = (newStudent.className || '').toLowerCase().trim();

  const matchIndex = studentList.findIndex(
    s =>
      s.id === newStudent.id ||
      (normId && normalizeIdentifier(s.studentId) === normId) ||
      (normAdm && normalizeIdentifier(s.admissionNumber) === normAdm) ||
      (normName &&
        normClass &&
        normalizeStudentName(s.name) === normName &&
        (s.className || '').toLowerCase().trim() === normClass)
  );

  if (matchIndex >= 0) {
    const existing = studentList[matchIndex];
    const updated = [...studentList];
    updated[matchIndex] = {
      ...existing,
      ...newStudent,
      id: existing.id, // Preserve canonical document ID
      studentId: newStudent.studentId || existing.studentId,
      admissionNumber: newStudent.admissionNumber || existing.admissionNumber,
      academicHistory: [
        ...(existing.academicHistory || []).filter(
          h =>
            !(
              newStudent.academicHistory?.[0] &&
              h.session === newStudent.academicHistory[0].session &&
              h.term === newStudent.academicHistory[0].term
            )
        ),
        ...(newStudent.academicHistory || []),
      ],
    };
    return { updatedList: updated, wasOverwritten: true };
  }

  return { updatedList: [newStudent, ...studentList], wasOverwritten: false };
}
