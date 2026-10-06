import * as XLSX from 'xlsx';
import { Student, AssessmentRecord, ClassItem, SectionItem, AttendanceRecord } from '../types';

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
  availableSections: SectionItem[]
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
        errors.push({
          row: rowNum,
          field: 'Student ID',
          message: `Student ID "${studentIdRaw}" already exists in system`,
          type: 'error',
        });
        hasRowError = true;
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
        errors.push({
          row: rowNum,
          field: 'Admission Number',
          message: `Admission Number "${admRaw}" already registered to another student`,
          type: 'error',
        });
        hasRowError = true;
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
  XLSX.writeFile(wb, `${cleanClass}_${section}_${term.replace(/\s+/g, '_')}_Broadsheet.xlsx`);
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
