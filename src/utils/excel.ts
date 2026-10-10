import * as XLSX from 'xlsx';
import {
  Student,
  AssessmentRecord,
  ClassItem,
  SectionItem,
  AttendanceRecord,
  AppDatabase,
  SubjectScore,
} from '../types';
import { calculateGrade, rankAssessments } from './ranking';
import { isSubjectApplicableToClass } from './subjectMapping';

export interface ExcelValidationError {
  row: number;
  field: string;
  message: string;
  type: 'error' | 'warning';
  raw?: any;
}

export interface TargetFieldDef {
  key: keyof Student | 'ignore';
  label: string;
  required: boolean;
  aliases: string[];
}

export const TARGET_FIELDS: TargetFieldDef[] = [
  {
    key: 'name',
    label: 'Student Name',
    required: true,
    aliases: ['student name', 'name', 'full name', 'fullname', 'pupil name', 'learner name', 'student_name', 'names'],
  },
  {
    key: 'studentId',
    label: 'Student ID',
    required: false,
    aliases: ['student id', 'studentid', 'student_id', 'id', 'id number', 'reg no', 'registration no', 'matric no', 'roll no'],
  },
  {
    key: 'admissionNumber',
    label: 'Admission Number',
    required: false,
    aliases: ['admission number', 'admission no', 'admission_number', 'admissionno', 'adm no', 'adm_no', 'adm #', 'admission'],
  },
  {
    key: 'className',
    label: 'Class',
    required: true,
    aliases: ['class', 'class name', 'classname', 'grade', 'level', 'standard', 'class_name'],
  },
  {
    key: 'section',
    label: 'Section / Arm',
    required: false,
    aliases: ['section', 'arm', 'stream', 'division', 'group', 'class section', 'section_name'],
  },
  {
    key: 'gender',
    label: 'Gender / Sex',
    required: true,
    aliases: ['gender', 'sex', 'male/female', 'm/f'],
  },
  {
    key: 'dateOfBirth',
    label: 'Date of Birth (DOB)',
    required: false,
    aliases: ['date of birth', 'dob', 'birth date', 'birthdate', 'd.o.b', 'date_of_birth'],
  },
  {
    key: 'parentName',
    label: 'Parent / Guardian Name',
    required: false,
    aliases: ['parent name', 'parent', 'guardian', 'father name', 'mother name', 'next of kin', 'sponsor', 'parent/guardian'],
  },
  {
    key: 'parentPhone',
    label: 'Parent Phone Number',
    required: false,
    aliases: ['parent phone', 'phone', 'telephone', 'mobile', 'parent mobile', 'contact number', 'gsm', 'contact', 'parent_phone'],
  },
  {
    key: 'address',
    label: 'Residential Address',
    required: false,
    aliases: ['address', 'residence', 'home address', 'residential address', 'location', 'city'],
  },
  {
    key: 'admissionDate',
    label: 'Admission Date',
    required: false,
    aliases: ['admission date', 'date of admission', 'enrollment date', 'admitted on', 'reg date'],
  },
  {
    key: 'status',
    label: 'Student Status',
    required: false,
    aliases: ['status', 'student status', 'enrollment status', 'active status'],
  },
];

export interface RawSpreadsheetData {
  headers: string[];
  rawRows: any[][];
  fileName: string;
}

export type ColumnMapping = Record<string, string>; // spreadsheetHeader -> targetFieldKey

export interface FlexibleImportResult {
  totalRows: number;
  validStudents: Student[];
  errors: ExcelValidationError[];
  warnings: ExcelValidationError[];
  detectedClasses: string[];
  detectedSections: string[];
}

/**
 * Reads workbook file and returns headers and rows
 */
export async function parseRawSpreadsheet(file: File): Promise<RawSpreadsheetData> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  if (rawRows.length === 0) {
    throw new Error('Spreadsheet file is completely empty.');
  }

  // Find the header row (first non-empty row)
  let headerIndex = -1;
  for (let i = 0; i < Math.min(10, rawRows.length); i++) {
    const row = rawRows[i];
    if (row && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error('Could not find header row in spreadsheet.');
  }

  const headers = rawRows[headerIndex].map(h => String(h || '').trim());
  const dataRows = rawRows.slice(headerIndex + 1).filter(r => 
    r && r.some(c => c !== undefined && c !== null && String(c).trim() !== '')
  );

  return {
    headers,
    rawRows: dataRows,
    fileName: file.name,
  };
}

/**
 * Intelligent auto-mapping of uploaded headers to target system fields
 */
export function autoDetectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const usedTargetKeys = new Set<string>();

  headers.forEach(header => {
    const norm = header.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const def of TARGET_FIELDS) {
      if (def.key === 'ignore' || usedTargetKeys.has(def.key)) continue;

      const matched = def.aliases.some(alias => {
        const normAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
        return norm === normAlias || norm.includes(normAlias);
      });

      if (matched) {
        mapping[header] = def.key;
        usedTargetKeys.add(def.key);
        break;
      }
    }
    if (!mapping[header]) {
      mapping[header] = 'ignore';
    }
  });

  return mapping;
}

/**
 * Discovers new classes & sections present in spreadsheet that do not yet exist in setup
 */
export function detectNewClassesAndSections(
  rawRows: any[][],
  headers: string[],
  mapping: ColumnMapping,
  existingClasses: ClassItem[],
  existingSections: SectionItem[]
): { newClasses: string[]; newSections: string[] } {
  const classColIdx = headers.findIndex(h => mapping[h] === 'className');
  const sectionColIdx = headers.findIndex(h => mapping[h] === 'section');

  const existingClassNames = new Set(existingClasses.map(c => c.name.toLowerCase().trim()));
  const existingSectionNames = new Set(existingSections.map(s => s.name.toLowerCase().trim()));

  const foundClasses = new Set<string>();
  const foundSections = new Set<string>();

  rawRows.forEach(row => {
    if (classColIdx >= 0 && row[classColIdx]) {
      const cls = String(row[classColIdx]).trim();
      if (cls && !existingClassNames.has(cls.toLowerCase())) {
        foundClasses.add(cls);
      }
    }

    if (sectionColIdx >= 0 && row[sectionColIdx]) {
      const sec = String(row[sectionColIdx]).trim();
      if (sec && !existingSectionNames.has(sec.toLowerCase())) {
        foundSections.add(sec);
      }
    }
  });

  return {
    newClasses: Array.from(foundClasses),
    newSections: Array.from(foundSections),
  };
}

/**
 * Validates spreadsheet data using configured column mapping
 */
export function validateMappedSpreadsheet(
  rawRows: any[][],
  headers: string[],
  mapping: ColumnMapping,
  existingStudents: Student[],
  availableClasses: ClassItem[],
  availableSections: SectionItem[],
  allowOverrideExisting: boolean = true
): FlexibleImportResult {
  const validStudents: Student[] = [];
  const errors: ExcelValidationError[] = [];
  const warnings: ExcelValidationError[] = [];

  const existingStudentIds = new Set(existingStudents.map(s => s.studentId.toLowerCase().trim()));
  const existingAdmNumbers = new Set(
    existingStudents.map(s => s.admissionNumber.toLowerCase().trim()).filter(Boolean)
  );

  const seenSheetStudentIds = new Set<string>();
  const seenSheetAdmNumbers = new Set<string>();

  const validClassMap = new Map(availableClasses.map(c => [c.name.toLowerCase().trim(), c.name]));
  const validSectionMap = new Map(availableSections.map(s => [s.name.toLowerCase().trim(), s.name]));

  // Find column indices
  const colIndex: Record<string, number> = {};
  TARGET_FIELDS.forEach(f => {
    colIndex[f.key] = headers.findIndex(h => mapping[h] === f.key);
  });

  let seqCounter = existingStudents.length + 1;
  const detectedClasses = new Set<string>();
  const detectedSections = new Set<string>();

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2; // Row number in spreadsheet (accounting for header)
    let hasRowError = false;

    // 1. Student Name
    const nameRaw = colIndex.name >= 0 ? String(row[colIndex.name] || '').trim() : '';
    if (!nameRaw) {
      errors.push({
        row: rowNum,
        field: 'Student Name',
        message: 'Student Name is required',
        type: 'error',
      });
      hasRowError = true;
    }

    // 2. Class
    const classRaw = colIndex.className >= 0 ? String(row[colIndex.className] || '').trim() : '';
    let finalClass = availableClasses[0]?.name || 'Nursery One';
    if (!classRaw) {
      errors.push({
        row: rowNum,
        field: 'Class',
        message: 'Class is missing for this student',
        type: 'error',
      });
      hasRowError = true;
    } else {
      detectedClasses.add(classRaw);
      const matched = validClassMap.get(classRaw.toLowerCase());
      if (matched) {
        finalClass = matched;
      } else {
        errors.push({
          row: rowNum,
          field: 'Class',
          message: `Class "${classRaw}" is not configured in setup`,
          type: 'error',
        });
        hasRowError = true;
      }
    }

    // 3. Section
    const sectionRaw = colIndex.section >= 0 ? String(row[colIndex.section] || '').trim() : '';
    let finalSection = availableSections[0]?.name || 'A';
    if (sectionRaw) {
      detectedSections.add(sectionRaw);
      const matched = validSectionMap.get(sectionRaw.toLowerCase());
      if (matched) {
        finalSection = matched;
      } else {
        warnings.push({
          row: rowNum,
          field: 'Section',
          message: `Section "${sectionRaw}" not in setup; defaulting to "${finalSection}"`,
          type: 'warning',
        });
      }
    }

    // 4. Gender
    const genderRaw = colIndex.gender >= 0 ? String(row[colIndex.gender] || '').trim().toLowerCase() : '';
    let finalGender: 'Male' | 'Female' = 'Male';
    if (genderRaw === 'male' || genderRaw === 'm' || genderRaw === 'boy') {
      finalGender = 'Male';
    } else if (genderRaw === 'female' || genderRaw === 'f' || genderRaw === 'girl') {
      finalGender = 'Female';
    } else if (!genderRaw) {
      warnings.push({
        row: rowNum,
        field: 'Gender',
        message: 'Gender was blank; assigned Male by default',
        type: 'warning',
      });
    } else {
      errors.push({
        row: rowNum,
        field: 'Gender',
        message: `Invalid gender "${genderRaw}". Must be Male or Female.`,
        type: 'error',
      });
      hasRowError = true;
    }

    // 5. Student ID (Auto-generate if missing in school's spreadsheet!)
    let studentIdRaw = colIndex.studentId >= 0 ? String(row[colIndex.studentId] || '').trim() : '';
    if (!studentIdRaw) {
      studentIdRaw = `STU-${new Date().getFullYear()}-${String(seqCounter++).padStart(3, '0')}`;
      warnings.push({
        row: rowNum,
        field: 'Student ID',
        message: `Student ID was missing; auto-generated "${studentIdRaw}"`,
        type: 'warning',
      });
    } else {
      const lower = studentIdRaw.toLowerCase();
      if (existingStudentIds.has(lower)) {
        if (allowOverrideExisting) {
          warnings.push({
            row: rowNum,
            field: 'Student ID',
            message: `Student ID "${studentIdRaw}" exists in system; will override/update existing profile (no duplicate).`,
            type: 'warning',
          });
        } else {
          errors.push({
            row: rowNum,
            field: 'Student ID',
            message: `Student ID "${studentIdRaw}" already exists in system`,
            type: 'error',
          });
          hasRowError = true;
        }
      } else if (seenSheetStudentIds.has(lower)) {
        errors.push({
          row: rowNum,
          field: 'Student ID',
          message: `Duplicate Student ID "${studentIdRaw}" in spreadsheet`,
          type: 'error',
        });
        hasRowError = true;
      }
    }

    // 6. Admission Number (Auto-generate if missing)
    let admRaw = colIndex.admissionNumber >= 0 ? String(row[colIndex.admissionNumber] || '').trim() : '';
    if (!admRaw) {
      admRaw = `ADM/${new Date().getFullYear()}/${studentIdRaw.replace(/[^0-9]/g, '') || seqCounter}`;
    } else {
      const lowerAdm = admRaw.toLowerCase();
      if (existingAdmNumbers.has(lowerAdm)) {
        if (allowOverrideExisting) {
          warnings.push({
            row: rowNum,
            field: 'Admission Number',
            message: `Admission Number "${admRaw}" already exists; will override/update existing student.`,
            type: 'warning',
          });
        } else {
          errors.push({
            row: rowNum,
            field: 'Admission Number',
            message: `Admission Number "${admRaw}" already registered to another student`,
            type: 'error',
          });
          hasRowError = true;
        }
      } else if (seenSheetAdmNumbers.has(lowerAdm)) {
        errors.push({
          row: rowNum,
          field: 'Admission Number',
          message: `Duplicate Admission Number "${admRaw}" in spreadsheet`,
          type: 'error',
        });
        hasRowError = true;
      }
    }

    // Other optional fields
    const dobRaw = colIndex.dateOfBirth >= 0 ? String(row[colIndex.dateOfBirth] || '').trim() : '';
    const parentNameRaw = colIndex.parentName >= 0 ? String(row[colIndex.parentName] || '').trim() : '';
    const parentPhoneRaw = colIndex.parentPhone >= 0 ? String(row[colIndex.parentPhone] || '').trim() : '';
    const addressRaw = colIndex.address >= 0 ? String(row[colIndex.address] || '').trim() : '';
    const admissionDateRaw = colIndex.admissionDate >= 0 ? String(row[colIndex.admissionDate] || '').trim() : '';
    const statusRaw = colIndex.status >= 0 ? String(row[colIndex.status] || '').trim() : 'Active';

    let finalStatus: 'Active' | 'Inactive' | 'Graduated' | 'Withdrawn' = 'Active';
    const sLower = statusRaw.toLowerCase();
    if (sLower === 'inactive') finalStatus = 'Inactive';
    else if (sLower === 'graduated') finalStatus = 'Graduated';
    else if (sLower === 'withdrawn') finalStatus = 'Withdrawn';

    if (!hasRowError) {
      seenSheetStudentIds.add(studentIdRaw.toLowerCase());
      if (admRaw) seenSheetAdmNumbers.add(admRaw.toLowerCase());

      validStudents.push({
        id: `stu-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`,
        studentId: studentIdRaw,
        admissionNumber: admRaw,
        name: nameRaw,
        className: finalClass,
        section: finalSection,
        gender: finalGender,
        dateOfBirth: dobRaw,
        parentName: parentNameRaw,
        parentPhone: parentPhoneRaw,
        address: addressRaw,
        admissionDate: admissionDateRaw || new Date().toISOString().split('T')[0],
        status: finalStatus,
      });
    }
  });

  return {
    totalRows: rawRows.length,
    validStudents,
    errors,
    warnings,
    detectedClasses: Array.from(detectedClasses),
    detectedSections: Array.from(detectedSections),
  };
}

/**
 * Generates and triggers download of recommended student template excel file
 */
export function downloadStudentTemplate(classes: ClassItem[], sections: SectionItem[]) {
  const classNames = classes.map(c => c.name).join(', ');
  const sectionNames = sections.map(s => s.name).join(', ');

  const headers = [
    'Student Name',
    'Student ID',
    'Admission Number',
    'Class',
    'Section',
    'Gender',
    'Date of Birth',
    'Parent/Guardian',
    'Parent Phone',
    'Address',
    'Admission Date',
    'Status',
  ];

  const sampleRows = [
    [
      'Bilal Abdullahi',
      'STU-2026-050',
      'ADM/2026/050',
      classes[0]?.name || 'Nursery One',
      sections[0]?.name || 'A',
      'Male',
      '2021-03-15',
      'Abdullahi Umar',
      '08031234567',
      'Bole Street, Yola Town',
      '2024-09-10',
      'Active',
    ],
    [
      'Hauwa Mansur',
      'STU-2026-051',
      'ADM/2026/051',
      classes[0]?.name || 'Nursery One',
      sections[0]?.name || 'A',
      'Female',
      '2021-05-20',
      'Mansur Lawal',
      '08029876543',
      'Lamido Zubairu Way, Yola',
      '2024-09-10',
      'Active',
    ],
  ];

  const wsData = [
    headers,
    ...sampleRows,
    [],
    ['NOTE & INSTRUCTIONS:'],
    [`Configured Classes: ${classNames}`],
    [`Configured Sections: ${sectionNames}`],
    ['Gender: Male or Female'],
    ['Status: Active, Inactive, Graduated, Withdrawn'],
    ['Note: If your existing school spreadsheet has different column headers (e.g. "Full Name", "Adm No"), our system will automatically match them during upload!'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 26 }, // Name
    { wch: 16 }, // ID
    { wch: 18 }, // Adm No
    { wch: 16 }, // Class
    { wch: 12 }, // Section
    { wch: 10 }, // Gender
    { wch: 14 }, // DOB
    { wch: 22 }, // Parent
    { wch: 16 }, // Phone
    { wch: 28 }, // Address
    { wch: 14 }, // Date
    { wch: 12 }, // Status
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students_Template');
  XLSX.writeFile(wb, 'Islamic_School_Student_Template.xlsx');
}

/**
 * Export students to Excel
 */
export function exportStudentsToExcel(students: Student[], filenamePrefix = 'Students') {
  const data = students.map((s, index) => ({
    'S/N': index + 1,
    'Student ID': s.studentId,
    'Student Name': s.name,
    'Admission Number': s.admissionNumber,
    Class: s.className,
    Section: s.section,
    Gender: s.gender,
    'Date of Birth': s.dateOfBirth || '',
    'Parent/Guardian': s.parentName || '',
    'Parent Phone': s.parentPhone || '',
    Address: s.address || '',
    'Admission Date': s.admissionDate || '',
    Status: s.status,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  XLSX.writeFile(wb, `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Export Class Assessment Broad Sheet to Excel
 */
export function exportAssessmentBroadsheetToExcel(
  assessments: AssessmentRecord[],
  studentMap: Record<string, Student>,
  className: string,
  section: string,
  session: string,
  term: string
) {
  const rows = assessments.map(rec => {
    const student = studentMap[rec.studentId];
    const row: any = {
      Position: rec.finalPosition || '-',
      'Student ID': rec.studentId,
      'Student Name': student ? student.name : rec.studentId,
      'Admission No': student ? student.admissionNumber : '',
      Class: rec.className,
      Arm: rec.section || '-',
      Gender: student ? student.gender : '',
    };

    rec.subjectScores?.forEach(sc => {
      row[`${sc.subjectName} (CA1)`] = sc.ca1;
      row[`${sc.subjectName} (CA2)`] = sc.ca2;
      row[`${sc.subjectName} (Exam)`] = sc.exam;
      row[`${sc.subjectName} (Total)`] = sc.total;
      row[`${sc.subjectName} (Grade)`] = sc.grade;
      row[`${sc.subjectName} (Pos)`] = sc.position || '-';
    });

    row['Total Score'] = rec.totalScore;
    row['Final Average (%)'] = rec.finalAverage;
    row['Days Present'] = rec.daysPresent;
    row['Days Absent'] = rec.daysAbsent;
    row['Teacher Remark'] = rec.formTeacherComment || '';
    row['Promotion Remark'] = rec.promotionRemark || '';

    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Broadsheet');
  const cleanClass = className.replace(/\s+/g, '_');
  const sectionLabel = section === 'ALL' || !section ? 'All_Arms' : section;
  XLSX.writeFile(wb, `${cleanClass}_${sectionLabel}_${term.replace(/\s+/g, '_')}_Broadsheet.xlsx`);
}

/**
 * Export Attendance Records to Excel
 */
export function exportAttendanceToExcel(
  records: AttendanceRecord[],
  studentMap: Record<string, Student>,
  session: string,
  term: string,
  className?: string
) {
  const data = records.map((r, idx) => ({
    'S/N': idx + 1,
    'Student ID': r.studentId,
    'Student Name': studentMap[r.studentId]?.name || r.studentId,
    Class: r.className,
    Section: r.section,
    'Days Opened': r.daysOpened,
    'Days Present': r.daysPresent,
    'Days Absent': r.daysAbsent,
    'Attendance Rate (%)': r.daysOpened > 0 ? Math.round((r.daysPresent / r.daysOpened) * 100) : 0,
    Remark: r.remark || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  const name = className ? `${className.replace(/\s+/g, '_')}_Attendance` : 'School_Attendance';
  XLSX.writeFile(wb, `${name}_${session.replace('/', '-')}_${term.replace(/\s+/g, '_')}.xlsx`);
}

/**
 * =========================================================================
 * ASSESSMENT SHEET TEMPLATE & PARSER (WITH AUTOMATIC STUDENT ENROLLMENT GUARD)
 * =========================================================================
 */

export interface AssessmentSheetImportResult {
  totalRows: number;
  validRecords: number;
  allStudents: Student[];
  newStudentsToEnroll: Student[];
  existingStudentsMatched: Student[];
  assessmentRecords: AssessmentRecord[];
  attendanceRecords: AttendanceRecord[];
  detectedClasses: string[];
  detectedSections: string[];
  detectedSubjects: string[];
  errors: ExcelValidationError[];
  warnings: ExcelValidationError[];
}

/**
 * Downloads a structured Excel Assessment Sheet Template for teachers and admin.
 * Includes explicit System Guards and auto-enrollment instructions.
 */
export function downloadAssessmentSheetTemplate(
  db: AppDatabase,
  targetClass?: string,
  targetSection?: string
) {
  const ca1Max = db.settings.ca1Max || 20;
  const ca2Max = db.settings.ca2Max || 20;
  const examMax = db.settings.examMax || 60;
  const activeSubjects = (db.subjects || []).filter(s => {
    if (!s.isActive) return false;
    if (targetClass) {
      return isSubjectApplicableToClass(s, targetClass, db.classes);
    }
    return true;
  });
  const subjectsToUse =
    activeSubjects.length > 0
      ? activeSubjects
      : (db.subjects || []).filter(s => s.isActive);

  const defaultSession = db.settings.currentSession || '2026/2027';
  const defaultTerm = db.settings.currentTerm || '1st Term';
  const defaultClass = targetClass || db.classes[0]?.name || 'Primary One';
  const defaultSection = targetSection || db.sections[0]?.name || 'A';

  // Base headers
  const baseHeaders = [
    'Student Name *',
    'Admission Number',
    'Student ID',
    'Class *',
    'Section',
    'Gender',
    'Session',
    'Term',
  ];

  // Subject assessment score columns (CA1, CA2, Exam)
  const subjectHeaders: string[] = [];
  subjectsToUse.forEach(sub => {
    subjectHeaders.push(`${sub.name} CA1 (Max ${ca1Max})`);
    subjectHeaders.push(`${sub.name} CA2 (Max ${ca2Max})`);
    subjectHeaders.push(`${sub.name} Exam (Max ${examMax})`);
  });

  const trailingHeaders = [
    'Days Opened',
    'Days Present',
    'Days Absent',
    'Teacher Comment',
    'Promotion Remark',
  ];

  const headers = [...baseHeaders, ...subjectHeaders, ...trailingHeaders];

  // If a class was chosen, pre-populate existing students for that class
  const existingClassStudents = targetClass
    ? db.students.filter(
        s =>
          s.className === targetClass &&
          (!targetSection || s.section === targetSection) &&
          s.status === 'Active'
      )
    : [];

  let rows: any[][] = [];

  if (existingClassStudents.length > 0) {
    rows = existingClassStudents.map(s => {
      const row: any[] = [
        s.name,
        s.admissionNumber || '',
        s.studentId || '',
        s.className,
        s.section,
        s.gender || 'Male',
        defaultSession,
        defaultTerm,
      ];
      // Blank scores ready for input
      subjectsToUse.forEach(() => {
        row.push(''); // CA1
        row.push(''); // CA2
        row.push(''); // Exam
      });
      row.push(90); // Days opened
      row.push(85); // Days present
      row.push(5);  // Days absent
      row.push('Good academic progress and moral conduct.');
      row.push('PASS & PROMOTED');
      return row;
    });
  } else {
    // Realistic sample rows
    rows = [
      [
        'Muhammad Ahmad Aliyu',
        'ADM/2026/001',
        'STU-2026-001',
        defaultClass,
        defaultSection,
        'Male',
        defaultSession,
        defaultTerm,
        ...subjectsToUse.flatMap((_, idx) => [18 - (idx % 3), 19 - (idx % 2), 54 - (idx % 4)]),
        90,
        88,
        2,
        'Excellent Quranic recitation and exemplary conduct.',
        'PASS & PROMOTED',
      ],
      [
        'Aisha Muhammad Ardo',
        'ADM/2026/002',
        'STU-2026-002',
        defaultClass,
        defaultSection,
        'Female',
        defaultSession,
        defaultTerm,
        ...subjectsToUse.flatMap((_, idx) => [19 - (idx % 2), 18 - (idx % 3), 52 - (idx % 5)]),
        90,
        86,
        4,
        'Outstanding dedication and respectful demeanor.',
        'PASS & PROMOTED',
      ],
      [
        'Fatima Umar Aliyu',
        'ADM/2026/003',
        'STU-2026-003',
        defaultClass,
        defaultSection,
        'Female',
        defaultSession,
        defaultTerm,
        ...subjectsToUse.flatMap((_, idx) => [17 - (idx % 2), 17 - (idx % 2), 50 - (idx % 3)]),
        90,
        85,
        5,
        'Very good effort throughout the school term.',
        'PASS & PROMOTED',
      ],
    ];
  }

  const wb = XLSX.utils.book_new();

  // SHEET 1: Data entry sheet
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 28 }, // Name
    { wch: 18 }, // Adm No
    { wch: 16 }, // ID
    { wch: 16 }, // Class
    { wch: 10 }, // Section
    { wch: 10 }, // Gender
    { wch: 14 }, // Session
    { wch: 12 }, // Term
    ...subjectsToUse.flatMap(() => [{ wch: 16 }, { wch: 16 }, { wch: 16 }]),
    { wch: 14 }, // Days Opened
    { wch: 14 }, // Days Present
    { wch: 14 }, // Days Absent
    { wch: 38 }, // Comment
    { wch: 20 }, // Promotion Remark
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Assessment_Scores');

  // SHEET 2: GUARD & GUIDELINES EXPLANATION
  const guardRows = [
    ['ISLAMIC SCHOOL MANAGEMENT SYSTEM - ASSESSMENT SHEET GUARDS & RULES'],
    ['========================================================================================================'],
    ['IMPORTANT SYSTEM GUARDS EMBEDDED IN THIS ASSESSMENT SHEET:'],
    [''],
    ['1. [GUARD 1: AUTOMATIC STUDENT ENROLLMENT - CORE FEATURE]'],
    ['   Any student included in this sheet who does NOT already exist in the school portal will be'],
    ['   AUTOMATICALLY ADDED to the portal as an Active student!'],
    ['   The student will be registered immediately with their Name, Class, Section, and Admission No.'],
    ['   Remaining profile details (such as parent name, parent phone, residential address, date of birth, photo)'],
    ['   can easily be updated or filled later anytime under the "Students" directory.'],
    [''],
    ['2. [GUARD 2: DUPLICATE PREVENTION GUARD]'],
    ['   If a student is already registered (matched by Admission Number, Student ID, or Name in the same Class),'],
    ['   the portal will link the scores to their existing record without creating duplicate student profiles.'],
    [''],
    ['3. [GUARD 3: SCORE BOUNDARIES GUARD]'],
    [`   - First Continuous Assessment (CA1): Maximum score is ${ca1Max}`],
    [`   - Second Continuous Assessment (CA2): Maximum score is ${ca2Max}`],
    [`   - Terminal Examination (Exam): Maximum score is ${examMax}`],
    ['   - Subject Total: Maximum score is 100%'],
    ['   Any marks entered exceeding these boundaries will be guarded and clamped safely during import.'],
    [''],
    ['4. [GUARD 4: AUTOMATIC CLASS RANKING & GRADES]'],
    ['   When you upload this completed sheet, the portal will automatically:'],
    ['   - Compute subject totals and letter grades (A, B, C, D, E, F)'],
    ['   - Calculate student overall total scores and percentage averages'],
    ['   - Calculate subject-level ranks and overall class positions (1st, 2nd, 3rd...)'],
    ['   - Instantly generate student report cards, broadsheets, and class summaries!'],
    [''],
    ['5. [SCHOOL REFERENCE DATA]'],
    [`   Academic Session: ${defaultSession}`],
    [`   Current Term: ${defaultTerm}`],
    [`   Classes in School: ${db.classes.map(c => c.name).join(', ')}`],
    [`   Sections in School: ${db.sections.map(s => s.name).join(', ')}`],
    [`   Active Subjects: ${subjectsToUse.map(s => s.name).join(', ')}`],
  ];

  const wsGuards = XLSX.utils.aoa_to_sheet(guardRows);
  wsGuards['!cols'] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, wsGuards, 'SYSTEM_GUARDS_&_RULES');

  const cleanClassName = targetClass ? targetClass.replace(/\s+/g, '_') : 'School';
  XLSX.writeFile(wb, `${cleanClassName}_Assessment_Sheet_Template.xlsx`);
}

/**
 * Normalizes and matches raw class names from Excel to canonical school classes.
 * Handles:
 * - "Primary 1" -> "Primary One"
 * - "Primary 2A" -> Class: "Primary Two", Section: "A"
 * - "Pri 2" -> "Primary Two"
 * - "JSS 1" -> "JSS One"
 * - "Nursery 1" -> "Nursery One"
 * - "Basic 1" -> "Primary One"
 */
export function matchCanonicalClass(
  rawClassName: string,
  availableClasses: ClassItem[]
): { className: string; section?: string } {
  if (!rawClassName) return { className: '' };
  const clean = rawClassName.trim();

  // 1. Direct case-insensitive match
  const exact = availableClasses.find(
    c => c.name.toLowerCase().trim() === clean.toLowerCase()
  );
  if (exact) return { className: exact.name };

  // 2. Check for embedded section e.g. "Primary 2A", "Primary 2 (A)", "Primary 2 - A", "Primary Two A"
  const sectionMatch = clean.match(/^(.+?)(?:\s*[\(\-\/]\s*|\s+)([A-Za-z])(?:\))?$/);
  let baseName = clean;
  let extractedSection: string | undefined = undefined;

  if (sectionMatch) {
    baseName = sectionMatch[1].trim();
    extractedSection = sectionMatch[2].toUpperCase();
  }

  // 3. Number to word mapping: 1 -> One, 2 -> Two, 3 -> Three, 4 -> Four, 5 -> Five, 6 -> Six
  const numToWords: Record<string, string> = {
    '1': 'One',
    '2': 'Two',
    '3': 'Three',
    '4': 'Four',
    '5': 'Five',
    '6': 'Six',
  };

  let normalizedBase = baseName
    .replace(/\bpri\b/gi, 'Primary')
    .replace(/\bnur\b/gi, 'Nursery')
    .replace(/\bkg\b/gi, 'Kindergarten')
    .replace(/\bbasic\b/gi, 'Primary');

  Object.entries(numToWords).forEach(([num, word]) => {
    normalizedBase = normalizedBase.replace(new RegExp(`\\b${num}\\b`, 'g'), word);
  });

  const matched = availableClasses.find(
    c => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedBase.toLowerCase().replace(/[^a-z0-9]/g, '')
  );
  if (matched) {
    return { className: matched.name, section: extractedSection };
  }

  const matchedOriginal = availableClasses.find(
    c => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === baseName.toLowerCase().replace(/[^a-z0-9]/g, '')
  );
  if (matchedOriginal) {
    return { className: matchedOriginal.name, section: extractedSection };
  }

  return { className: clean, section: extractedSection };
}

/**
 * Parses and validates an uploaded Assessment Spreadsheet.
 * AUTOMATIC STUDENT ENROLLMENT: Any student not already in db.students is created!
 */
export async function parseAndValidateAssessmentSpreadsheet(
  file: File,
  db: AppDatabase,
  overrideSession?: string,
  overrideTerm?: string,
  overrideClass?: string,
  overrideSection?: string
): Promise<AssessmentSheetImportResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  // 1. Select score sheet intelligently
  let sheetName = wb.SheetNames[0];
  if (wb.SheetNames.includes('Assessment_Scores')) {
    sheetName = 'Assessment_Scores';
  } else if (overrideClass && wb.SheetNames.some(s => s.toLowerCase().includes(overrideClass.toLowerCase()))) {
    sheetName = wb.SheetNames.find(s => s.toLowerCase().includes(overrideClass.toLowerCase()))!;
  } else {
    // Scan all sheets to find the one containing student rows
    let bestSheet = wb.SheetNames[0];
    let maxScore = -1;
    for (const sName of wb.SheetNames) {
      if (sName.toLowerCase().includes('guard') || sName.toLowerCase().includes('rule') || sName.toLowerCase().includes('instruction')) {
        continue;
      }
      const testWs = wb.Sheets[sName];
      const rows: any[][] = XLSX.utils.sheet_to_json(testWs, { header: 1 });
      if (!rows || rows.length === 0) continue;
      let score = rows.length;
      const headerSnippet = rows.slice(0, 10).flat().map(c => String(c || '').toLowerCase()).join(' ');
      if (headerSnippet.includes('name') || headerSnippet.includes('student')) score += 500;
      if (headerSnippet.includes('ca') || headerSnippet.includes('exam') || headerSnippet.includes('score')) score += 500;
      if (score > maxScore) {
        maxScore = score;
        bestSheet = sName;
      }
    }
    sheetName = bestSheet;
  }

  const ws = wb.Sheets[sheetName];

  // ENSURE WORKBOOK RANGE COVERS ALL CELLS (prevent XLSX from truncating beyond row 20)
  if (ws) {
    let maxR = 0;
    let maxC = 0;
    for (const key of Object.keys(ws)) {
      if (key.startsWith('!')) continue;
      try {
        const cell = XLSX.utils.decode_cell(key);
        if (cell.r > maxR) maxR = cell.r;
        if (cell.c > maxC) maxC = cell.c;
      } catch (e) {
        // ignore invalid cell keys
      }
    }
    const curRef = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
    if (maxR > curRef.e.r || maxC > curRef.e.c) {
      ws['!ref'] = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: Math.max(curRef.e.r, maxR), c: Math.max(curRef.e.c, maxC) }
      });
    }
  }

  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const errors: ExcelValidationError[] = [];
  const warnings: ExcelValidationError[] = [];

  if (!rawRows || rawRows.length === 0) {
    return {
      totalRows: 0,
      validRecords: 0,
      allStudents: [],
      newStudentsToEnroll: [],
      existingStudentsMatched: [],
      assessmentRecords: [],
      attendanceRecords: [],
      detectedClasses: [],
      detectedSections: [],
      detectedSubjects: [],
      errors: [{ row: 1, field: 'file', message: 'The spreadsheet is empty', type: 'error' }],
      warnings: [],
    };
  }

  // Scan top banner rows (0 to 6) for sheet-level class, section, session, or term metadata
  let sheetMetaClass = '';
  let sheetMetaSection = '';
  let sheetMetaSession = '';
  let sheetMetaTerm = '';

  for (let r = 0; r < Math.min(6, rawRows.length); r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;
    const textJoined = row.map(c => String(c || '').replace(/\u00A0/g, ' ').trim()).join(' ');

    const clsM = textJoined.match(/(?:class|grade|level)\s*[:=\-]?\s*([a-zA-Z0-9\s]+?)(?:arm|section|term|session|\n|$)/i);
    if (clsM && clsM[1] && !sheetMetaClass) {
      sheetMetaClass = clsM[1].trim();
    }
    const secM = textJoined.match(/(?:section|arm|stream)\s*[:=\-]?\s*([a-zA-Z0-9])/i);
    if (secM && secM[1] && !sheetMetaSection) {
      sheetMetaSection = secM[1].trim().toUpperCase();
    }
    const sessM = textJoined.match(/(?:session|year)\s*[:=\-]?\s*(\d{4}\s*\/\s*\d{4})/i);
    if (sessM && sessM[1] && !sheetMetaSession) {
      sheetMetaSession = sessM[1].replace(/\s+/g, '');
    }
    const termM = textJoined.match(/(1st\s*Term|2nd\s*Term|3rd\s*Term|First\s*Term|Second\s*Term|Third\s*Term)/i);
    if (termM && termM[1] && !sheetMetaTerm) {
      sheetMetaTerm = termM[1].replace(/First\s*Term/i, '1st Term').replace(/Second\s*Term/i, '2nd Term').replace(/Third\s*Term/i, '3rd Term');
    }
  }

  // 2. Intelligent Multi-Score Header Row Detection (Top 6 rows max to prevent skipping student rows!)
  let headerRowIndex = 0;
  let highestHeaderScore = -1;

  for (let r = 0; r < Math.min(6, rawRows.length); r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;
    const lowerTexts = row.map(cell => String(cell || '').replace(/\u00A0/g, ' ').toLowerCase().trim()).filter(Boolean);
    if (lowerTexts.length === 0) continue;

    let score = 0;
    // Check for student name indicators
    if (lowerTexts.some(t => t.includes('student name') || t.includes('pupil name') || t.includes('full name') || t === 'name' || t.includes('candidate') || t.includes('learner name'))) {
      score += 50;
    } else if (lowerTexts.some(t => t === 'student' || t === 'pupil' || t === 'names' || t.includes('name of'))) {
      score += 35;
    }

    // Check for admission / ID
    if (lowerTexts.some(t => t.includes('adm') || t.includes('admission') || t.includes('id') || t.includes('reg'))) score += 25;
    // Check for class / grade / section
    if (lowerTexts.some(t => t.includes('class') || t.includes('grade') || t.includes('section') || t.includes('arm'))) score += 20;
    // Check for score keywords
    if (lowerTexts.some(t => t.includes('ca1') || t.includes('ca2') || t.includes('exam') || t.includes('total') || t.includes('score') || t.includes('test'))) score += 35;

    // Check for known subject names
    const hasKnownSubject = lowerTexts.some(t =>
      (db.subjects || []).some(s => t.includes(s.name.toLowerCase().trim())) ||
      ['arabic', 'english', 'mathematics', 'maths', 'quran', 'hadith', 'islamic', 'irs', 'science', 'computer'].some(kw => t.includes(kw))
    );
    if (hasKnownSubject) score += 25;

    if (score > highestHeaderScore) {
      highestHeaderScore = score;
      headerRowIndex = r;
      if (score >= 90) break; // Decisive header row match
    }
  }

  // Support 2-row merged headers ONLY if row right below is a true subheader with multiple score keywords and no student data
  const baseHeaderRow = (rawRows[headerRowIndex] || []).map(cell => String(cell || '').replace(/\u00A0/g, ' ').trim());
  const combinedHeaders: string[] = [...baseHeaderRow];

  let hasTrueSubHeaderRow = false;
  const nextRow = rawRows[headerRowIndex + 1];
  if (Array.isArray(nextRow)) {
    const nextLower = nextRow.map(c => String(c || '').replace(/\u00A0/g, ' ').toLowerCase().trim());
    const scoreKeywordsCount = nextLower.filter(
      t =>
        t === 'ca1' ||
        t === 'ca2' ||
        t === 'ca 1' ||
        t === 'ca 2' ||
        t === 'exam' ||
        t === 'total' ||
        t === 'test 1' ||
        t === 'test 2' ||
        t === '1st ca' ||
        t === '2nd ca'
    ).length;

    // Only classify as subheader if >= 2 score sub-labels exist AND first cells do NOT contain numbers like S/N "1" or student names
    const firstCell = String(nextRow[0] || '').trim();
    const secondCell = String(nextRow[1] || '').trim();
    const thirdCell = String(nextRow[2] || '').trim();
    const isStudentDataRow =
      (firstCell === '1' && secondCell.length > 2) ||
      (secondCell === '1' && thirdCell.length > 2) ||
      firstCell === '1' ||
      secondCell === '1';

    if (scoreKeywordsCount >= 2 && !isStudentDataRow) {
      hasTrueSubHeaderRow = true;
      let currentParentHeader = '';
      for (let i = 0; i < Math.max(baseHeaderRow.length, nextRow.length); i++) {
        if (baseHeaderRow[i] && baseHeaderRow[i].trim() !== '') {
          currentParentHeader = baseHeaderRow[i].trim();
        }
        const sub = String(nextRow[i] || '').trim();
        if (sub && currentParentHeader && !sub.toLowerCase().includes('name') && !sub.toLowerCase().includes('adm')) {
          combinedHeaders[i] = `${currentParentHeader} ${sub}`.trim();
        }
      }
    }
  }

  const rawHeaders = combinedHeaders;
  const lowerHeaders = rawHeaders.map(h => h.toLowerCase());

  // 3. Identify Meta Columns
  const findColIndex = (predicates: string[], exclusions: string[] = []): number => {
    return lowerHeaders.findIndex(
      h =>
        predicates.some(p => h.includes(p)) &&
        !exclusions.some(ex => h.includes(ex))
    );
  };

  const nameExclusions = ['teacher', 'school', 'arabic', 'subject', 'head', 'sub'];
  let colName = findColIndex(
    ['student name', 'pupil name', 'full name', 'candidate name', 'learner name', 'name of student', 'names of student', 'student_name', 'pupil_name', 'names'],
    nameExclusions
  );
  if (colName === -1) {
    colName = findColIndex(['student', 'pupil', 'candidate', 'learner', 'fullname'], nameExclusions);
  }
  if (colName === -1) {
    colName = findColIndex(['name'], nameExclusions);
  }

  // Also check for split Surname and First Name columns
  const colSurname = findColIndex(['surname', 'last name', 'lastname'], nameExclusions);
  const colFirstName = findColIndex(['first name', 'firstname', 'given name', 'other name', 'other names'], nameExclusions);

  const colAdm = findColIndex(['admission number', 'admission no', 'adm no', 'adm_no', 'admission', 'adm. no', 'adm']);
  const colId = findColIndex(['student id', 'studentid', 'student_id', 'id number', 'reg no', 'registration no']);
  const colClass = findColIndex(['class', 'grade', 'level']);
  const colSection = findColIndex(['section', 'arm', 'stream']);
  const colGender = findColIndex(['gender', 'sex']);
  const colSession = findColIndex(['session', 'academic session', 'year']);
  const colTerm = findColIndex(['term', 'semester']);
  const colDaysOpened = findColIndex(['days opened', 'school opened', 'opened', 'times opened']);
  const colDaysPresent = findColIndex(['days present', 'present', 'times present', 'attendance']);
  const colDaysAbsent = findColIndex(['days absent', 'absent', 'times absent']);
  const colComment = findColIndex(['teacher comment', 'form teacher comment', 'remark', 'comment']);
  const colPromotion = findColIndex(['promotion remark', 'promotion']);

  // If no single name column found, but surname & firstname found, we can use surname as reference
  if (colName === -1 && colSurname !== -1) {
    colName = colSurname;
  }

  // Fallback: If still not found, check if first or second column has text strings
  if (colName === -1 && rawRows.length > headerRowIndex + 1) {
    for (let c = 0; c < Math.min(4, lowerHeaders.length); c++) {
      if (c !== colAdm && c !== colId && c !== colClass && c !== colSection) {
        const sampleVal = String(rawRows[headerRowIndex + 1]?.[c] || '').trim();
        if (sampleVal && isNaN(Number(sampleVal)) && sampleVal.length > 3) {
          colName = c;
          break;
        }
      }
    }
  }

  if (colName === -1) {
    return {
      totalRows: 0,
      validRecords: 0,
      allStudents: [],
      newStudentsToEnroll: [],
      existingStudentsMatched: [],
      assessmentRecords: [],
      attendanceRecords: [],
      detectedClasses: [],
      detectedSections: [],
      detectedSubjects: [],
      errors: [
        {
          row: headerRowIndex + 1,
          field: 'Student Name',
          message: 'Could not find a "Student Name" column in the header row',
          type: 'error',
        },
      ],
      warnings: [],
    };
  }

  // 4. Map Subject Score Columns
  const activeSubjects = (db.subjects || []).filter(s => s.isActive);
  const detectedSubjectCols: Array<{
    subjectName: string;
    arabicName: string;
    subjectId: string;
    colCa1: number;
    colCa2: number;
    colExam: number;
    colTotal: number;
  }> = [];

  const detectedSubjectNamesSet = new Set<string>();

  // Helper to match subject with aliases
  const matchSubjectInHeader = (headerLower: string, subName: string): boolean => {
    const cleanSub = subName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanH = headerLower.replace(/[^a-z0-9]/g, '');
    if (cleanH.includes(cleanSub)) return true;

    // Common subject aliases
    if (cleanSub.includes('math') && cleanH.includes('math')) return true;
    if (cleanSub.includes('eng') && cleanH.includes('eng')) return true;
    if (cleanSub.includes('arabic') && (cleanH.includes('arab') || cleanH.includes('lugh'))) return true;
    if (cleanSub.includes('islam') && (cleanH.includes('islam') || cleanH.includes('irs') || cleanH.includes('is'))) return true;
    if (cleanSub.includes('quran') && cleanH.includes('qur')) return true;
    if (cleanSub.includes('hadith') && cleanH.includes('had')) return true;
    if (cleanSub.includes('tahfiz') && cleanH.includes('tahf')) return true;
    return false;
  };

  activeSubjects.forEach(sub => {
    let colCa1 = -1;
    let colCa2 = -1;
    let colExam = -1;
    let colTotal = -1;

    lowerHeaders.forEach((h, idx) => {
      if (idx === colName || idx === colAdm || idx === colId || idx === colClass || idx === colSection || idx === colGender) return;
      if (matchSubjectInHeader(h, sub.name)) {
        if (h.includes('ca1') || h.includes('1st ca') || h.includes('ca 1') || h.includes('first ca') || h.includes('test 1') || h.includes('1st test')) {
          colCa1 = idx;
        } else if (h.includes('ca2') || h.includes('2nd ca') || h.includes('ca 2') || h.includes('second ca') || h.includes('test 2') || h.includes('2nd test')) {
          colCa2 = idx;
        } else if (h.includes('exam') || h.includes('examination')) {
          colExam = idx;
        } else if (h.includes('total') || h.includes('score')) {
          colTotal = idx;
        } else if (colExam === -1 && colCa1 === -1 && colCa2 === -1) {
          colExam = idx;
        }
      }
    });

    if (colCa1 !== -1 || colCa2 !== -1 || colExam !== -1 || colTotal !== -1) {
      detectedSubjectCols.push({
        subjectName: sub.name,
        arabicName: sub.arabicName,
        subjectId: sub.id,
        colCa1,
        colCa2,
        colExam,
        colTotal,
      });
      detectedSubjectNamesSet.add(sub.name);
    }
  });

  // Auto-detect columns that look like subjects not already mapped
  lowerHeaders.forEach((h, idx) => {
    const isMeta = [
      colName,
      colAdm,
      colId,
      colClass,
      colSection,
      colGender,
      colSession,
      colTerm,
      colDaysOpened,
      colDaysPresent,
      colDaysAbsent,
      colComment,
      colPromotion,
    ].includes(idx);

    if (!isMeta) {
      const alreadyCaptured = detectedSubjectCols.some(
        ds => ds.colCa1 === idx || ds.colCa2 === idx || ds.colExam === idx || ds.colTotal === idx
      );
      if (!alreadyCaptured) {
        const cleanTitle = rawHeaders[idx]
          .replace(/\(.*\)/g, '')
          .replace(/ca1|ca2|exam|total|score|max\s*\d+|test/gi, '')
          .trim();
        if (cleanTitle.length >= 2 && !detectedSubjectNamesSet.has(cleanTitle)) {
          detectedSubjectCols.push({
            subjectName: cleanTitle,
            arabicName: cleanTitle,
            subjectId: `sub-detected-${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            colCa1: h.includes('ca1') || h.includes('test 1') ? idx : -1,
            colCa2: h.includes('ca2') || h.includes('test 2') ? idx : -1,
            colExam: h.includes('exam') ? idx : (h.includes('ca') ? -1 : idx),
            colTotal: h.includes('total') ? idx : -1,
          });
          detectedSubjectNamesSet.add(cleanTitle);
        }
      }
    }
  });

  const ca1Max = db.settings.ca1Max || 20;
  const ca2Max = db.settings.ca2Max || 20;
  const examMax = db.settings.examMax || 60;

  const allStudents: Student[] = [];
  const newStudentsToEnroll: Student[] = [];
  const existingStudentsMatched: Student[] = [];
  const rawAssessmentRecords: AssessmentRecord[] = [];
  const attendanceRecords: AttendanceRecord[] = [];
  const detectedClassesSet = new Set<string>();
  const detectedSectionsSet = new Set<string>();

  // Map existing students for fast, accurate matching
  const existingStudentByAdm = new Map<string, Student>();
  const existingStudentById = new Map<string, Student>();
  const existingStudentByNameAndClass = new Map<string, Student>();
  const existingStudentByName = new Map<string, Student>();

  (db.students || []).forEach(s => {
    if (s.admissionNumber) existingStudentByAdm.set(s.admissionNumber.toLowerCase().trim(), s);
    if (s.studentId) existingStudentById.set(s.studentId.toLowerCase().trim(), s);
    const normName = s.name.toLowerCase().replace(/\s+/g, ' ').trim();
    const normClass = (s.className || '').toLowerCase().trim();
    existingStudentByNameAndClass.set(`${normName}__${normClass}`, s);
    if (!existingStudentByName.has(normName)) {
      existingStudentByName.set(normName, s);
    }
  });

  let studentIdCounter = (db.students?.length || 0) + 1;
  const sessionYear = (overrideSession || db.settings.currentSession || '2026/2027').split('/')[0];

  // 5. Parse Each Student & Assessment Row
  const startRow = hasTrueSubHeaderRow ? headerRowIndex + 2 : headerRowIndex + 1;
  const colSn = findColIndex(['s/n', 'sn', 's.n', 's.no', 'serial no', 'serial number', 'no.', 'no']);

  let lastSeenClass = sheetMetaClass || overrideClass || '';
  let lastSeenSection = sheetMetaSection || overrideSection || '';

  for (let r = startRow; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || !Array.isArray(row)) continue;

    const rawAdm = colAdm !== -1 && row[colAdm] ? String(row[colAdm]).trim() : '';
    const rawId = colId !== -1 && row[colId] ? String(row[colId]).trim() : '';
    const rawGender = colGender !== -1 && row[colGender] ? String(row[colGender]).trim().toLowerCase() : '';

    let rowStudentName = '';
    if (colSurname !== -1 && colFirstName !== -1 && colSurname !== colFirstName) {
      const sur = String(row[colSurname] || '').trim();
      const first = String(row[colFirstName] || '').trim();
      if (sur && first) {
        rowStudentName = `${sur} ${first}`.replace(/\s+/g, ' ').trim();
      }
    }
    if (!rowStudentName && colName !== -1) {
      rowStudentName = String(row[colName] || '').replace(/\s+/g, ' ').trim();
    }

    // Robust Fallback: If student name was blank or in a non-standard column, search text cells in first 6 columns
    if (!rowStudentName) {
      for (let c = 0; c < Math.min(row.length, 6); c++) {
        if (c === colAdm || c === colId || c === colClass || c === colSection || c === colSn) continue;
        const cellVal = String(row[c] || '').trim();
        if (
          cellVal &&
          isNaN(Number(cellVal)) &&
          cellVal.length >= 2 &&
          !cellVal.toLowerCase().startsWith('adm') &&
          !cellVal.toLowerCase().startsWith('stu') &&
          !['male', 'female', 'm', 'f'].includes(cellVal.toLowerCase())
        ) {
          rowStudentName = cellVal;
          break;
        }
      }
    }

    // If still blank, but admission number, ID or S/N exists, do not discard student!
    if (!rowStudentName && (rawAdm || rawId)) {
      rowStudentName = `Student ${rawAdm || rawId}`;
    } else if (!rowStudentName && colSn !== -1 && row[colSn]) {
      const snVal = String(row[colSn]).trim();
      if (snVal && !isNaN(Number(snVal))) {
        rowStudentName = `Student #${snVal}`;
      }
    }

    // Check if row has any subject scores entered (never drop a student who has marks!)
    const hasAnyRowMarks = detectedSubjectCols.some(dsc => {
      const c1 = dsc.colCa1 !== -1 && row[dsc.colCa1] !== undefined && row[dsc.colCa1] !== '';
      const c2 = dsc.colCa2 !== -1 && row[dsc.colCa2] !== undefined && row[dsc.colCa2] !== '';
      const ex = dsc.colExam !== -1 && row[dsc.colExam] !== undefined && row[dsc.colExam] !== '';
      const tot = dsc.colTotal !== -1 && row[dsc.colTotal] !== undefined && row[dsc.colTotal] !== '';
      return c1 || c2 || ex || tot;
    });

    if (!rowStudentName && hasAnyRowMarks) {
      rowStudentName = `Student Row #${r + 1}`;
    }

    if (!rowStudentName) continue; // Skip completely empty row

    // Skip summary / footnote rows
    const upperName = rowStudentName.toUpperCase();
    if (
      upperName.startsWith('NOTE') ||
      upperName.startsWith('---') ||
      upperName.startsWith('TOTAL') ||
      upperName.startsWith('AVERAGE') ||
      upperName.startsWith('GRAND') ||
      upperName.startsWith('CLASS TEACHER') ||
      upperName.startsWith('HEAD TEACHER') ||
      upperName === 'STUDENT NAME' ||
      upperName === 'NAMES' ||
      upperName === 'NAME'
    ) {
      continue;
    }

    // Extract raw class & section, inheriting from previous row if cells were merged/blank in Excel
    let rawRowClass = (colClass !== -1 && row[colClass] ? String(row[colClass]).trim() : '');
    let rawRowSection = (colSection !== -1 && row[colSection] ? String(row[colSection]).trim() : '');

    if (!rawRowClass && lastSeenClass) {
      rawRowClass = lastSeenClass;
    }
    if (!rawRowSection && lastSeenSection) {
      rawRowSection = lastSeenSection;
    }

    // Canonical Class Normalization (e.g. "Primary 1" -> "Primary One", "Pri 2A" -> "Primary Two" + Section "A")
    const { className: canonicalClass, section: extractedSec } = matchCanonicalClass(
      rawRowClass || overrideClass || db.classes[0]?.name || 'Primary One',
      db.classes
    );

    const rowClass = canonicalClass;
    const resolvedSection = (
      extractedSec ||
      rawRowSection ||
      sheetMetaSection ||
      overrideSection ||
      (db.sections[0]?.name || 'A')
    ).trim().toUpperCase();

    const rowSection = resolvedSection;

    if (rowClass) lastSeenClass = rowClass;
    if (rowSection) lastSeenSection = rowSection;

    const rowSession =
      (colSession !== -1 && row[colSession] ? String(row[colSession]).trim() : '') ||
      sheetMetaSession ||
      overrideSession ||
      db.settings.currentSession ||
      '2026/2027';

    const rowTerm =
      (colTerm !== -1 && row[colTerm] ? String(row[colTerm]).trim() : '') ||
      sheetMetaTerm ||
      overrideTerm ||
      db.settings.currentTerm ||
      '1st Term';

    detectedClassesSet.add(rowClass);
    if (rowSection) detectedSectionsSet.add(rowSection);

    // =========================================================================
    // AUTOMATIC STUDENT ADDITION OR OVERWRITE
    // "if student is not added is should add student or overwrite it"
    // =========================================================================
    let matchedExisting: Student | null = null;
    const normName = rowStudentName.toLowerCase().replace(/\s+/g, ' ').trim();
    const normClass = rowClass.toLowerCase().trim();

    if (rawAdm && existingStudentByAdm.has(rawAdm.toLowerCase().trim())) {
      matchedExisting = existingStudentByAdm.get(rawAdm.toLowerCase().trim())!;
    } else if (rawId && existingStudentById.has(rawId.toLowerCase().trim())) {
      matchedExisting = existingStudentById.get(rawId.toLowerCase().trim())!;
    } else if (existingStudentByNameAndClass.has(`${normName}__${normClass}`)) {
      const candidate = existingStudentByNameAndClass.get(`${normName}__${normClass}`)!;
      const conflictAdm =
        rawAdm &&
        candidate.admissionNumber &&
        rawAdm.toLowerCase().trim() !== candidate.admissionNumber.toLowerCase().trim();
      const conflictId =
        rawId &&
        candidate.studentId &&
        rawId.toLowerCase().trim() !== candidate.studentId.toLowerCase().trim();
      
      // Only match existing student if:
      // 1. Neither ID conflicts
      // 2. Name is at least 2 words (to prevent false collisions on single names like "Fatima")
      // 3. AND the candidate is NOT a student already enrolled earlier from THIS SAME uploaded file!
      if (!conflictAdm && !conflictId && normName.split(' ').length >= 2 && !newStudentsToEnroll.some(ns => ns.id === candidate.id)) {
        matchedExisting = candidate;
      }
    }

    let studentObj: Student;

    if (matchedExisting) {
      // OVERWRITE EXISTING STUDENT: Update with information from the sheet
      const resolvedGender = rawGender
        ? (rawGender.startsWith('f') ? 'Female' : 'Male')
        : matchedExisting.gender;

      studentObj = {
        ...matchedExisting,
        name: rowStudentName,
        className: rowClass,
        section: rowSection !== undefined ? rowSection : matchedExisting.section,
        gender: resolvedGender,
        admissionNumber: rawAdm || matchedExisting.admissionNumber,
        studentId: rawId || matchedExisting.studentId,
        status: 'Active',
        academicHistory: [
          ...(matchedExisting.academicHistory || []).filter(h => !(h.session === rowSession && h.term === rowTerm)),
          {
            session: rowSession,
            term: rowTerm,
            className: rowClass,
            section: rowSection,
            date: new Date().toISOString().split('T')[0],
            remark: 'Updated via Assessment Sheet Upload',
          },
        ],
      };

      if (!existingStudentsMatched.some(s => s.id === studentObj.id)) {
        existingStudentsMatched.push(studentObj);
      }
    } else {
      // Check if we already created this student in an earlier row of this sheet (only if IDs explicitly match)
      const newlyAdded = (rawAdm || rawId)
        ? newStudentsToEnroll.find(
            ns =>
              (rawAdm && ns.admissionNumber.toLowerCase() === rawAdm.toLowerCase()) ||
              (rawId && ns.studentId.toLowerCase() === rawId.toLowerCase())
          )
        : null;

      if (newlyAdded) {
        studentObj = newlyAdded;
      } else {
        // AUTOMATICALLY ENROLL NEW STUDENT
        while (
          (db.students || []).some(s => s.studentId === `STU-${sessionYear}-${String(studentIdCounter).padStart(3, '0')}`) ||
          newStudentsToEnroll.some(s => s.studentId === `STU-${sessionYear}-${String(studentIdCounter).padStart(3, '0')}`)
        ) {
          studentIdCounter++;
        }

        const generatedStudentId = rawId || `STU-${sessionYear}-${String(studentIdCounter).padStart(3, '0')}`;
        const generatedAdmissionNumber = rawAdm || `ADM/${sessionYear}/${String(studentIdCounter).padStart(3, '0')}`;
        studentIdCounter++;

        studentObj = {
          id: `stu-${Date.now()}-${r}-${Math.random().toString(36).substr(2, 6)}`,
          schoolId: db.schoolId || 'school-main',
          studentId: generatedStudentId,
          admissionNumber: generatedAdmissionNumber,
          name: rowStudentName,
          className: rowClass,
          section: rowSection,
          gender: rawGender.startsWith('f') ? 'Female' : 'Male',
          status: 'Active',
          academicHistory: [
            {
              session: rowSession,
              term: rowTerm,
              className: rowClass,
              section: rowSection,
              date: new Date().toISOString().split('T')[0],
              remark: 'Auto-enrolled via Assessment Sheet Upload',
            },
          ],
        };

        newStudentsToEnroll.push(studentObj);
        existingStudentByAdm.set(studentObj.admissionNumber.toLowerCase(), studentObj);
        existingStudentById.set(studentObj.studentId.toLowerCase(), studentObj);
        existingStudentByNameAndClass.set(`${studentObj.name.toLowerCase()}__${studentObj.className.toLowerCase()}`, studentObj);
      }
    }

    allStudents.push(studentObj);

    // =========================================================================
    // EXTRACT SUBJECT SCORES & BUILD ASSESSMENT RECORD
    // "if assessment is not added it should add or overwrite it"
    // =========================================================================
    const subjectScores: SubjectScore[] = [];

    detectedSubjectCols.forEach(dsc => {
      let ca1 = 0;
      let ca2 = 0;
      let exam = 0;
      let hasAnyScore = false;

      if (dsc.colCa1 !== -1 && row[dsc.colCa1] !== undefined && row[dsc.colCa1] !== '') {
        const val = Number(row[dsc.colCa1]);
        if (!isNaN(val)) {
          ca1 = Math.max(0, val);
          hasAnyScore = true;
          if (ca1 > ca1Max) {
            warnings.push({
              row: r + 1,
              field: `${dsc.subjectName} CA1`,
              message: `CA1 score (${ca1}) exceeds maximum ${ca1Max}. Score recorded.`,
              type: 'warning',
            });
          }
        }
      }

      if (dsc.colCa2 !== -1 && row[dsc.colCa2] !== undefined && row[dsc.colCa2] !== '') {
        const val = Number(row[dsc.colCa2]);
        if (!isNaN(val)) {
          ca2 = Math.max(0, val);
          hasAnyScore = true;
          if (ca2 > ca2Max) {
            warnings.push({
              row: r + 1,
              field: `${dsc.subjectName} CA2`,
              message: `CA2 score (${ca2}) exceeds maximum ${ca2Max}. Score recorded.`,
              type: 'warning',
            });
          }
        }
      }

      if (dsc.colExam !== -1 && row[dsc.colExam] !== undefined && row[dsc.colExam] !== '') {
        const val = Number(row[dsc.colExam]);
        if (!isNaN(val)) {
          exam = Math.max(0, val);
          hasAnyScore = true;
          if (exam > examMax) {
            warnings.push({
              row: r + 1,
              field: `${dsc.subjectName} Exam`,
              message: `Exam score (${exam}) exceeds maximum ${examMax}. Score recorded.`,
              type: 'warning',
            });
          }
        }
      }

      // If only Total was provided
      if (!hasAnyScore && dsc.colTotal !== -1 && row[dsc.colTotal] !== undefined && row[dsc.colTotal] !== '') {
        const val = Number(row[dsc.colTotal]);
        if (!isNaN(val)) {
          exam = Math.max(0, Math.min(100, val));
          hasAnyScore = true;
        }
      }

      if (hasAnyScore) {
        const total = Math.min(100, ca1 + ca2 + exam);
        const { grade } = calculateGrade(total, db.gradingBoundaries);
        subjectScores.push({
          subjectId: dsc.subjectId,
          subjectName: dsc.subjectName,
          arabicName: dsc.arabicName,
          ca1,
          ca2,
          exam,
          total,
          grade,
          position: '-',
        });
      }
    });

    // Attendance & Remarks
    const daysOpened = colDaysOpened !== -1 && row[colDaysOpened] !== undefined ? Number(row[colDaysOpened]) || 90 : 90;
    const daysPresent = colDaysPresent !== -1 && row[colDaysPresent] !== undefined ? Number(row[colDaysPresent]) || 85 : 85;
    const daysAbsent = colDaysAbsent !== -1 && row[colDaysAbsent] !== undefined ? Number(row[colDaysAbsent]) || Math.max(0, daysOpened - daysPresent) : Math.max(0, daysOpened - daysPresent);

    const comment = colComment !== -1 && row[colComment] ? String(row[colComment]).trim() : '';
    const promotion = colPromotion !== -1 && row[colPromotion] ? String(row[colPromotion]).trim() : '';

    const totalScore = subjectScores.reduce((acc, s) => acc + s.total, 0);
    const finalAverage = subjectScores.length > 0 ? Math.round((totalScore / subjectScores.length) * 10) / 10 : 0;

    let autoComment = comment;
    if (!autoComment) {
      if (finalAverage >= 80) autoComment = 'Outstanding performance, highly commendable discipline.';
      else if (finalAverage >= 65) autoComment = 'Very good progress throughout the academic term.';
      else if (finalAverage >= 50) autoComment = 'Satisfactory performance, with room for improvement.';
      else autoComment = 'Needs more dedicated effort and academic support.';
    }

    let autoPromotion = promotion;
    if (!autoPromotion) {
      autoPromotion = finalAverage >= 50 ? 'PASS & PROMOTED' : 'FAIR';
    }

    // Resolve teacher and leadership
    const { className: canonicalRowClass, section: extractedRowSec } = matchCanonicalClass(rowClass, db.classes);
    const effectiveRowSec = rowSection || extractedRowSec;
    const matchedClassObj = db.classes.find(
      c =>
        c.name.toLowerCase().trim() === rowClass.toLowerCase().trim() ||
        c.name.toLowerCase().trim() === canonicalRowClass.toLowerCase().trim() ||
        c.id === rowClass
    );
    const termCfg = db.settings.termSettings?.[rowTerm];
    const defaultFees =
      matchedClassObj?.termFees?.[rowTerm] ||
      termCfg?.classFees?.[rowClass] ||
      matchedClassObj?.nextTermFees ||
      termCfg?.defaultFees ||
      db.settings.defaultNextTermFees ||
      '₦ 16,000';
    const defaultSchoolCloses =
      termCfg?.schoolCloses || db.settings.schoolCloses || '24th Dhul Hijjah 1447 / 10th June 2026';
    const defaultNextTermBegins =
      termCfg?.nextTermBegins || db.settings.nextTermBegins || '04th Muharram 1448 / 20th July 2026';

    const safeSessionKey = rowSession.replace(/[\/\s]/g, '-');
    const safeTermKey = rowTerm.replace(/[\/\s]/g, '');

    const assessmentRecord: AssessmentRecord = {
      id: `asm-${studentObj.studentId}-${safeSessionKey}-${safeTermKey}`,
      schoolId: db.schoolId || 'school-main',
      studentId: studentObj.studentId,
      academicSession: rowSession,
      term: rowTerm,
      className: rowClass,
      section: rowSection,
      subjectScores,
      totalScore,
      finalAverage,
      daysOpened,
      daysPresent,
      daysAbsent,
      psychomotorRatings: {
        'psy-1': 'A',
        'psy-2': 'A',
        'psy-3': 'A',
        'psy-4': 'B',
        'psy-5': 'A',
        'psy-6': 'A',
        'psy-7': 'A',
      },
      formTeacherName:
        (effectiveRowSec && (matchedClassObj?.sectionTeachers?.[effectiveRowSec] || matchedClassObj?.sectionTeachers?.[effectiveRowSec.toUpperCase()])) ||
        matchedClassObj?.classTeacherName ||
        'Class Form Teacher',
      formTeacherComment: autoComment,
      headTeacherName: db.settings.headTeacherName || 'Ustaz Al-Amin Kaigama',
      headTeacherComment: 'A commendable academic performance. Strive to maintain this standard.',
      promotionRemark: autoPromotion,
      schoolCloses: defaultSchoolCloses,
      nextTermBegins: defaultNextTermBegins,
      nextTermFees: defaultFees,
      updatedAt: new Date().toISOString(),
    };

    rawAssessmentRecords.push(assessmentRecord);

    if (daysOpened > 0) {
      attendanceRecords.push({
        id: `att-${studentObj.studentId}-${safeSessionKey}-${safeTermKey}`,
        schoolId: db.schoolId || 'school-main',
        studentId: studentObj.studentId,
        academicSession: rowSession,
        term: rowTerm,
        className: rowClass,
        section: rowSection,
        daysOpened,
        daysPresent,
        daysAbsent,
        remark: daysAbsent > 5 ? 'Irregular' : 'Regular',
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // 6. Rank Assessments within Class/Section groups
  const groupedAssessments: Record<string, AssessmentRecord[]> = {};
  rawAssessmentRecords.forEach(rec => {
    const key = `${rec.className}__${rec.section}__${rec.academicSession}__${rec.term}`;
    if (!groupedAssessments[key]) groupedAssessments[key] = [];
    groupedAssessments[key].push(rec);
  });

  const finalRankedAssessments: AssessmentRecord[] = [];
  Object.values(groupedAssessments).forEach(group => {
    const ranked = rankAssessments(group);
    finalRankedAssessments.push(...ranked);
  });

  return {
    totalRows: rawAssessmentRecords.length,
    validRecords: finalRankedAssessments.length,
    allStudents,
    newStudentsToEnroll,
    existingStudentsMatched,
    assessmentRecords: finalRankedAssessments,
    attendanceRecords,
    detectedClasses: Array.from(detectedClassesSet),
    detectedSections: Array.from(detectedSectionsSet),
    detectedSubjects: Array.from(detectedSubjectNamesSet),
    errors,
    warnings,
  };
}

