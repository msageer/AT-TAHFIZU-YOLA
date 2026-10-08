import React, { useState, useRef } from 'react';
import {
  AppDatabase,
  Student,
  ClassItem,
  SectionItem,
  AssessmentRecord,
  AttendanceRecord,
} from '../types';
import {
  downloadStudentTemplate,
  downloadAssessmentSheetTemplate,
  parseRawSpreadsheet,
  autoDetectColumnMapping,
  detectNewClassesAndSections,
  validateMappedSpreadsheet,
  parseAndValidateAssessmentSpreadsheet,
  exportStudentsToExcel,
  exportAssessmentBroadsheetToExcel,
  exportAttendanceToExcel,
  TARGET_FIELDS,
  RawSpreadsheetData,
  ColumnMapping,
  FlexibleImportResult,
  AssessmentSheetImportResult,
} from '../utils/excel';
import { getSectionsForClass } from '../utils/classSections';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle,
  AlertTriangle,
  Users,
  Database,
  CalendarCheck,
  Plus,
  ShieldCheck,
  Award,
  Sparkles,
  ArrowRight,
  ClipboardCheck,
  AlertCircle,
  X,
} from 'lucide-react';

interface ExcelManagerProps {
  db: AppDatabase;
  onImportStudents: (students: Student[]) => void;
  onImportAssessmentSheet?: (
    newStudents: Student[],
    newAssessments: AssessmentRecord[],
    newAttendance: AttendanceRecord[],
    detectedClasses: string[],
    detectedSections: string[]
  ) => void;
  onAutoAddClasses: (newClasses: ClassItem[]) => void;
  onAutoAddSections: (newSections: SectionItem[]) => void;
}

export const ExcelManager: React.FC<ExcelManagerProps> = ({
  db,
  onImportStudents,
  onImportAssessmentSheet,
  onAutoAddClasses,
  onAutoAddSections,
}) => {
  // Navigation tabs within Excel Manager
  const [activeTab, setActiveTab] = useState<'assessment' | 'students' | 'exports'>('assessment');

  // ==========================================
  // 1. ASSESSMENT SHEET STATE
  // ==========================================
  const [assessmentTemplateClass, setAssessmentTemplateClass] = useState<string>('');
  const [assessmentTemplateSection, setAssessmentTemplateSection] = useState<string>('');
  const [isAssessmentProcessing, setIsAssessmentProcessing] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentSheetImportResult | null>(null);
  const [assessmentUploadFileName, setAssessmentUploadFileName] = useState<string>('');
  const [assessmentSession, setAssessmentSession] = useState<string>(
    db.settings.currentSession || '2026/2027'
  );
  const [assessmentTerm, setAssessmentTerm] = useState<string>(
    db.settings.currentTerm || '1st Term'
  );
  const [assessmentNotification, setAssessmentNotification] = useState<string | null>(null);
  const assessmentFileInputRef = useRef<HTMLInputElement>(null);

  // Download Assessment Sheet Template
  const handleDownloadAssessmentTemplate = () => {
    downloadAssessmentSheetTemplate(
      db,
      assessmentTemplateClass || undefined,
      assessmentTemplateSection || undefined
    );
  };

  // Upload Assessment Spreadsheet
  const handleAssessmentFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAssessmentProcessing(true);
    setAssessmentResult(null);
    setAssessmentUploadFileName(file.name);
    try {
      const result = await parseAndValidateAssessmentSpreadsheet(
        file,
        db,
        assessmentSession,
        assessmentTerm
      );
      setAssessmentResult(result);
    } catch (err: any) {
      alert(`Error reading assessment sheet: ${err.message || 'Invalid format'}`);
    } finally {
      setIsAssessmentProcessing(false);
      if (assessmentFileInputRef.current) assessmentFileInputRef.current.value = '';
    }
  };

  // Confirm Assessment Import (with Automatic Student Enrollment)
  const handleConfirmAssessmentImport = () => {
    if (!assessmentResult) return;

    if (onImportAssessmentSheet) {
      onImportAssessmentSheet(
        assessmentResult.newStudentsToEnroll,
        assessmentResult.assessmentRecords,
        assessmentResult.attendanceRecords,
        assessmentResult.detectedClasses,
        assessmentResult.detectedSections
      );

      const msg = `Successfully imported assessment sheet! Auto-enrolled ${assessmentResult.newStudentsToEnroll.length} new student(s) and recorded ${assessmentResult.assessmentRecords.length} assessment records.`;
      setAssessmentNotification(msg);
      setAssessmentResult(null);
      setAssessmentUploadFileName('');
      setTimeout(() => setAssessmentNotification(null), 6000);
    }
  };

  // ==========================================
  // 2. STUDENT DIRECTORY SPREADSHEET STATE
  // ==========================================
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawData, setRawData] = useState<RawSpreadsheetData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [detectedClasses, setDetectedClasses] = useState<string[]>([]);
  const [detectedSections, setDetectedSections] = useState<string[]>([]);
  const [validationResult, setValidationResult] = useState<FlexibleImportResult | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const studentFileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadStudentTemplate = () => {
    downloadStudentTemplate(db.classes, db.sections);
  };

  const handleStudentFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setSuccessMessage(null);
    try {
      const parsed = await parseRawSpreadsheet(file);
      setRawData(parsed);

      const mapping = autoDetectColumnMapping(parsed.headers);
      setColumnMapping(mapping);

      const detected = detectNewClassesAndSections(
        parsed.rawRows,
        parsed.headers,
        mapping,
        db.classes,
        db.sections
      );
      setDetectedClasses(detected.newClasses);
      setDetectedSections(detected.newSections);

      const result = validateMappedSpreadsheet(
        parsed.rawRows,
        parsed.headers,
        mapping,
        db.students,
        db.classes,
        db.sections
      );
      setValidationResult(result);
    } catch (err: any) {
      alert(`Error reading student spreadsheet: ${err.message || 'Invalid format'}`);
    } finally {
      setIsProcessing(false);
      if (studentFileInputRef.current) studentFileInputRef.current.value = '';
    }
  };

  const handleMappingChange = (header: string, targetKey: string) => {
    if (!rawData) return;
    const updated = { ...columnMapping, [header]: targetKey };
    setColumnMapping(updated);

    const detected = detectNewClassesAndSections(
      rawData.rawRows,
      rawData.headers,
      updated,
      db.classes,
      db.sections
    );
    setDetectedClasses(detected.newClasses);
    setDetectedSections(detected.newSections);

    const result = validateMappedSpreadsheet(
      rawData.rawRows,
      rawData.headers,
      updated,
      db.students,
      db.classes,
      db.sections
    );
    setValidationResult(result);
  };

  const handleAddClasses = () => {
    const newItems: ClassItem[] = detectedClasses.map((cls, idx) => ({
      id: `cls-auto-${Date.now()}-${idx}`,
      name: cls,
      order: db.classes.length + idx + 1,
    }));
    onAutoAddClasses(newItems);
    setDetectedClasses([]);
  };

  const handleAddSections = () => {
    const newItems: SectionItem[] = detectedSections.map((sec, idx) => ({
      id: `sec-auto-${Date.now()}-${idx}`,
      name: sec,
    }));
    onAutoAddSections(newItems);
    setDetectedSections([]);
  };

  const handleConfirmStudentImport = () => {
    if (!validationResult || validationResult.validStudents.length === 0) return;
    onImportStudents(validationResult.validStudents);
    setSuccessMessage(
      `Successfully imported ${validationResult.validStudents.length} student(s) into your school database!`
    );
    setRawData(null);
    setValidationResult(null);
  };

  // ==========================================
  // 3. EXPORTS STATE
  // ==========================================
  const [exportScope, setExportScope] = useState<'all' | 'class'>('all');
  const [selectedClassForExport, setSelectedClassForExport] = useState<string>(
    db.classes[0]?.name || 'Nursery One'
  );

  const [broadsheetSession, setBroadsheetSession] = useState<string>(
    db.settings.currentSession || '2026/2027'
  );
  const [broadsheetTerm, setBroadsheetTerm] = useState<string>(
    db.settings.currentTerm || '1st Term'
  );
  const [broadsheetClass, setBroadsheetClass] = useState<string>(
    db.classes[0]?.name || 'Nursery One'
  );
  const [broadsheetSection, setBroadsheetSection] = useState<string>(
    db.sections[0]?.name || 'A'
  );

  const handleExportStudents = () => {
    const list =
      exportScope === 'class'
        ? db.students.filter(s => s.className === selectedClassForExport)
        : db.students;

    if (list.length === 0) {
      alert('No student records found to export for the selected filter.');
      return;
    }
    exportStudentsToExcel(list, exportScope === 'class' ? selectedClassForExport : 'School_Students');
  };

  const handleExportBroadsheet = () => {
    const records = db.assessments.filter(
      a =>
        a.className === broadsheetClass &&
        a.section === broadsheetSection &&
        a.academicSession === broadsheetSession &&
        a.term === broadsheetTerm
    );

    if (records.length === 0) {
      alert(`No assessment records found for ${broadsheetClass} (${broadsheetSection}) in ${broadsheetTerm}.`);
      return;
    }

    const studentMap: Record<string, Student> = {};
    db.students.forEach(s => {
      studentMap[s.studentId] = s;
    });

    exportAssessmentBroadsheetToExcel(
      records,
      studentMap,
      broadsheetClass,
      broadsheetSection,
      broadsheetSession,
      broadsheetTerm
    );
  };

  const handleExportAttendance = () => {
    const studentMap: Record<string, Student> = {};
    db.students.forEach(s => {
      studentMap[s.studentId] = s;
    });

    const records = (db.attendance || []).filter(
      a =>
        a.academicSession === broadsheetSession &&
        a.term === broadsheetTerm &&
        (!broadsheetClass || a.className === broadsheetClass)
    );

    if (records.length === 0) {
      alert('No attendance records found for this session and term.');
      return;
    }

    exportAttendanceToExcel(records, studentMap, broadsheetSession, broadsheetTerm, broadsheetClass);
  };

  const ca1Max = db.settings.ca1Max || 20;
  const ca2Max = db.settings.ca2Max || 20;
  const examMax = db.settings.examMax || 60;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Spreadsheet Manager &amp; Assessment Import</h2>
          <p className="text-xs text-slate-500">
            Download assessment sheets, upload scores with auto-student enrollment, and export broadsheets.
          </p>
        </div>

        {/* Sub Navigation Pills */}
        <div className="flex items-center space-x-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
          <button
            onClick={() => setActiveTab('assessment')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'assessment'
                ? 'bg-blue-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Assessment Sheet</span>
          </button>

          <button
            onClick={() => setActiveTab('students')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center space-x-1.5 ${
              activeTab === 'students'
                ? 'bg-blue-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Student Directory</span>
          </button>

          <button
            onClick={() => setActiveTab('exports')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center space-x-1.5 ${
              activeTab === 'exports'
                ? 'bg-blue-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Broadsheet Exports</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {assessmentNotification && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center space-x-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{assessmentNotification}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: ASSESSMENT SHEET (TEMPLATE & AUTO-ENROLL UPLOAD)   */}
      {/* ========================================================= */}
      {activeTab === 'assessment' && (
        <div className="space-y-6">
          {/* System Guard Highlight Banner */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-xl p-5 text-white shadow-md border border-blue-800 space-y-3">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Embedded Assessment System Guards</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-white/10 backdrop-blur-xs border border-white/10 space-y-1">
                <div className="font-bold text-emerald-300 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>1. Auto-Student Enrollment</span>
                </div>
                <p className="text-[11px] text-slate-200 leading-relaxed">
                  Students in your assessment sheet not yet in the portal are <strong>automatically added as active students</strong>. Profile details (parents, phone, address, DOB) can be updated anytime in Students.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-white/10 backdrop-blur-xs border border-white/10 space-y-1">
                <div className="font-bold text-amber-300 flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>2. Score Limits Guard</span>
                </div>
                <p className="text-[11px] text-slate-200 leading-relaxed">
                  1st CA (Max {ca1Max}), 2nd CA (Max {ca2Max}), Exam (Max {examMax}). The system automatically checks bounds, clamps safely, and computes 100% totals.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-white/10 backdrop-blur-xs border border-white/10 space-y-1">
                <div className="font-bold text-purple-300 flex items-center space-x-1">
                  <Award className="w-3.5 h-3.5" />
                  <span>3. Auto-Ranking &amp; Report Cards</span>
                </div>
                <p className="text-[11px] text-slate-200 leading-relaxed">
                  Letter grades (A, B, C, D, E, F), subject positions (1st, 2nd...), class averages, and overall positions are automatically computed upon upload.
                </p>
              </div>
            </div>
          </div>

          {/* Dual Action Cards: Download Template & Upload Sheet */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CARD 1: DOWNLOAD ASSESSMENT TEMPLATE */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center space-x-2.5 text-blue-900">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-800">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Download Assessment Template</h3>
                  <p className="text-xs text-slate-500">
                    Get an Excel sheet with all your subjects, CA1, CA2, Exam columns &amp; embedded guards
                  </p>
                </div>
              </div>

              <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Select Target Class (Optional)
                  </label>
                  <select
                    value={assessmentTemplateClass}
                    onChange={e => {
                      const newCls = e.target.value;
                      setAssessmentTemplateClass(newCls);
                      if (newCls) {
                        const validSecs = getSectionsForClass(newCls, db.classes, db.sections);
                        if (assessmentTemplateSection && !validSecs.includes(assessmentTemplateSection)) {
                          setAssessmentTemplateSection('');
                        }
                      }
                    }}
                    className="w-full text-xs font-semibold border border-slate-300 rounded p-2 bg-white"
                  >
                    <option value="">Blank Template (Includes Sample Rows)</option>
                    {db.classes.map(c => (
                      <option key={c.id} value={c.name}>
                        {c.name} {db.students.filter(s => s.className === c.name).length > 0 ? `(${db.students.filter(s => s.className === c.name).length} students registered)` : '(Empty)'}
                      </option>
                    ))}
                  </select>
                </div>

                {assessmentTemplateClass && (
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">
                      Section / Arm
                    </label>
                    {getSectionsForClass(assessmentTemplateClass, db.classes, db.sections).length === 0 ? (
                      <div className="w-full text-xs font-medium border border-slate-200 rounded p-2 bg-slate-100 text-slate-500 italic">
                        No Section (Class Only)
                      </div>
                    ) : (
                      <select
                        value={assessmentTemplateSection}
                        onChange={e => setAssessmentTemplateSection(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-300 rounded p-2 bg-white"
                      >
                        <option value="">All Sections</option>
                        {getSectionsForClass(assessmentTemplateClass, db.classes, db.sections).map(secName => (
                          <option key={secName} value={secName}>
                            Section {secName}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={handleDownloadAssessmentTemplate}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2.5 px-4 rounded-lg transition shadow flex items-center justify-center space-x-2"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>
                  {assessmentTemplateClass
                    ? `Download ${assessmentTemplateClass} Assessment Sheet`
                    : 'Download School Assessment Excel Template'}
                </span>
              </button>
            </div>

            {/* CARD 2: UPLOAD ASSESSMENT SHEET */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center space-x-2.5 text-emerald-900">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Upload Filled Assessment Sheet</h3>
                  <p className="text-xs text-slate-500">
                    Accepts .xlsx, .xls, .csv. Automatically adds new students!
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Academic Session
                  </label>
                  <select
                    value={assessmentSession}
                    onChange={e => setAssessmentSession(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
                  >
                    {db.sessions.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Term
                  </label>
                  <select
                    value={assessmentTerm}
                    onChange={e => setAssessmentTerm(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
                  >
                    {db.terms.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <input
                type="file"
                ref={assessmentFileInputRef}
                onChange={handleAssessmentFileChange}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />

              <button
                onClick={() => assessmentFileInputRef.current?.click()}
                disabled={isAssessmentProcessing}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg transition shadow flex items-center justify-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>
                  {isAssessmentProcessing ? 'Analyzing Assessment Sheet...' : 'Upload & Verify Assessment Spreadsheet'}
                </span>
              </button>
            </div>
          </div>

          {/* ASSESSMENT IMPORT PREVIEW MODAL / SECTION */}
          {assessmentResult && (
            <div className="bg-white rounded-xl border border-blue-300 p-5 shadow-lg space-y-5 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-blue-100 text-blue-800">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Assessment Sheet Preview: &ldquo;{assessmentUploadFileName}&rdquo;
                    </h3>
                    <p className="text-xs text-slate-500">
                      Review auto-enrolled students and assessment computations before finalizing
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setAssessmentResult(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Rows Read</span>
                  <span className="text-xl font-black text-slate-900">{assessmentResult.totalRows}</span>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-center ring-2 ring-emerald-500/20">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                    ★ Auto-Enroll Students
                  </span>
                  <span className="text-xl font-black text-emerald-700">
                    +{assessmentResult.newStudentsToEnroll.length}
                  </span>
                  <span className="text-[9px] text-emerald-600 block">Will be added to portal!</span>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-blue-700 uppercase block">Existing Students</span>
                  <span className="text-xl font-black text-blue-800">
                    {assessmentResult.existingStudentsMatched.length}
                  </span>
                  <span className="text-[9px] text-blue-600 block">Scores attached</span>
                </div>

                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-purple-700 uppercase block">Assessments Ready</span>
                  <span className="text-xl font-black text-purple-800">
                    {assessmentResult.assessmentRecords.length}
                  </span>
                  <span className="text-[9px] text-purple-600 block">Ranked &amp; Graded</span>
                </div>
              </div>

              {/* Informative Auto-Enroll Callout */}
              {assessmentResult.newStudentsToEnroll.length > 0 && (
                <div className="p-3.5 bg-emerald-50/90 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
                  <div className="font-bold flex items-center space-x-1.5 text-emerald-900">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>
                      {assessmentResult.newStudentsToEnroll.length} New Student(s) Will Be Automatically Enrolled:
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    These students were found in your sheet but not in the database. When you click &ldquo;Confirm &amp; Import&rdquo;, they will be automatically registered into your school roster as active students. You can complete their profile information (parents, phone, DOB, address) anytime later under <strong>Students</strong>.
                  </p>
                </div>
              )}

              {/* Warnings List if any */}
              {assessmentResult.warnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center space-x-1.5 text-amber-800">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Score Warnings ({assessmentResult.warnings.length}):</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1 text-[11px] text-amber-800">
                    {assessmentResult.warnings.slice(0, 5).map((w, idx) => (
                      <div key={idx}>
                        Row {w.row}: {w.message}
                      </div>
                    ))}
                    {assessmentResult.warnings.length > 5 && (
                      <div className="italic">...and {assessmentResult.warnings.length - 5} more warnings.</div>
                    )}
                  </div>
                </div>
              )}

              {/* Preview Table of Records */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Enrollment Status</th>
                      <th className="py-2.5 px-3">Class &amp; Section</th>
                      <th className="py-2.5 px-3 text-center">Subjects Graded</th>
                      <th className="py-2.5 px-3 text-center">Total Score</th>
                      <th className="py-2.5 px-3 text-center">Final Average</th>
                      <th className="py-2.5 px-3 text-center">Class Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {assessmentResult.assessmentRecords.slice(0, 50).map((rec, idx) => {
                      const isNewStudent = assessmentResult.newStudentsToEnroll.some(
                        s => s.studentId === rec.studentId
                      );
                      const studentObj =
                        assessmentResult.newStudentsToEnroll.find(s => s.studentId === rec.studentId) ||
                        assessmentResult.existingStudentsMatched.find(s => s.studentId === rec.studentId) ||
                        db.students.find(s => s.studentId === rec.studentId);

                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{studentObj?.name || rec.studentId}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {studentObj?.admissionNumber || studentObj?.studentId}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {isNewStudent ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <span>★ Auto-Enroll</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                                <span>Existing Match</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {rec.className} {rec.section ? `(${rec.section})` : ''}
                          </td>
                          <td className="py-2.5 px-3 text-center">{rec.subjectScores.length} subjects</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900">{rec.totalScore}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-blue-700">{rec.finalAverage}%</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              {rec.finalPosition || '-'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setAssessmentResult(null)}
                  className="w-full sm:w-auto text-xs font-semibold px-4 py-2.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Cancel / Upload Different File
                </button>

                <button
                  onClick={handleConfirmAssessmentImport}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-6 rounded-lg transition shadow flex items-center justify-center space-x-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    Confirm &amp; Import Assessment Sheet (+{assessmentResult.newStudentsToEnroll.length} Auto-Enrolled)
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: STUDENT DIRECTORY (REGISTRATION IMPORT)            */}
      {/* ========================================================= */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          {successMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center space-x-2.5 text-blue-900">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-800">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Upload Student Directory Spreadsheet</h3>
                <p className="text-xs text-slate-500">
                  Import student records with automatic column matching &amp; class detection
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={handleDownloadStudentTemplate}
                className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-4 py-2.5 rounded-lg transition flex items-center justify-center space-x-1.5"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>Download Student Template</span>
              </button>

              <input
                type="file"
                ref={studentFileInputRef}
                onChange={handleStudentFileChange}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />

              <button
                onClick={() => studentFileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full sm:w-auto bg-blue-800 hover:bg-blue-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition flex items-center justify-center space-x-1.5 shadow"
              >
                <Upload className="w-4 h-4" />
                <span>{isProcessing ? 'Reading Spreadsheet...' : 'Upload Student Spreadsheet'}</span>
              </button>
            </div>
          </div>

          {/* Column Mapping and Validation if file was uploaded */}
          {rawData && validationResult && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Map Columns &amp; Verify Records ({validationResult.totalRows} Rows Found)
                </h3>
                <button
                  onClick={() => {
                    setRawData(null);
                    setValidationResult(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              </div>

              {/* Detected new classes/sections */}
              {(detectedClasses.length > 0 || detectedSections.length > 0) && (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-2 text-xs">
                  <div className="font-bold text-blue-900">New Classes or Sections Discovered:</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {detectedClasses.map(cls => (
                      <span key={cls} className="px-2.5 py-1 rounded bg-white border border-blue-200 text-blue-800 font-semibold">
                        Class: {cls}
                      </span>
                    ))}
                    {detectedSections.map(sec => (
                      <span key={sec} className="px-2.5 py-1 rounded bg-white border border-blue-200 text-blue-800 font-semibold">
                        Section: {sec}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center space-x-2 pt-1">
                    {detectedClasses.length > 0 && (
                      <button
                        onClick={handleAddClasses}
                        className="bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-semibold px-3 py-1 rounded"
                      >
                        Auto-Create Classes
                      </button>
                    )}
                    {detectedSections.length > 0 && (
                      <button
                        onClick={handleAddSections}
                        className="bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-semibold px-3 py-1 rounded"
                      >
                        Auto-Create Sections
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Mapping Grid */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 uppercase">Column Mapping:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  {rawData.headers.map(header => {
                    const mappedKey = columnMapping[header] || 'ignore';
                    return (
                      <div key={header} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                        <span className="font-semibold text-slate-800 truncate mr-2" title={header}>
                          {header}
                        </span>
                        <select
                          value={mappedKey}
                          onChange={e => handleMappingChange(header, e.target.value)}
                          className="text-[11px] font-bold border border-slate-300 rounded p-1 bg-white"
                        >
                          <option value="ignore">-- Skip / Ignore --</option>
                          {TARGET_FIELDS.map(f => (
                            <option key={f.key} value={f.key}>
                              {f.label} {f.required ? '*' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleConfirmStudentImport}
                  disabled={validationResult.validStudents.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-6 rounded-lg transition shadow flex items-center space-x-2 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Import {validationResult.validStudents.length} Valid Student Records</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: EXPORTS (BROADSHEETS & ATTENDANCE)                 */}
      {/* ========================================================= */}
      {activeTab === 'exports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card: Export Students */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center space-x-2.5 text-blue-900">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-800">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Export Student Directory</h3>
                <p className="text-xs text-slate-500">Download registered students to Excel (.xlsx)</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Export Scope</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={exportScope}
                    onChange={e => setExportScope(e.target.value as any)}
                    className="border border-slate-300 rounded p-2 bg-slate-50"
                  >
                    <option value="all">All Students ({db.students.length})</option>
                    <option value="class">Filter by Class</option>
                  </select>

                  {exportScope === 'class' && (
                    <select
                      value={selectedClassForExport}
                      onChange={e => setSelectedClassForExport(e.target.value)}
                      className="border border-slate-300 rounded p-2 bg-white"
                    >
                      {db.classes.map(c => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <button
                onClick={handleExportStudents}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold py-2.5 px-4 rounded-lg transition shadow flex items-center justify-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Export Students to Excel</span>
              </button>
            </div>
          </div>

          {/* Card: Export Assessment Broadsheet & Attendance */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center space-x-2.5 text-purple-900">
              <div className="p-2 rounded-lg bg-purple-50 text-purple-800">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Export Class Broadsheets</h3>
                <p className="text-xs text-slate-500">Download terminal assessment broadsheets &amp; attendance</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Class</label>
                <select
                  value={broadsheetClass}
                  onChange={e => {
                    const newCls = e.target.value;
                    setBroadsheetClass(newCls);
                    const validSecs = getSectionsForClass(newCls, db.classes, db.sections);
                    if (!validSecs.includes(broadsheetSection)) {
                      setBroadsheetSection(validSecs[0] || 'A');
                    }
                  }}
                  className="w-full border border-slate-300 rounded p-2 bg-white"
                >
                  {db.classes.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Section</label>
                {getSectionsForClass(broadsheetClass, db.classes, db.sections).length === 0 ? (
                  <div className="w-full border border-slate-200 rounded p-2 bg-slate-100 text-slate-500 italic text-xs">
                    No Section (Class Only)
                  </div>
                ) : (
                  <select
                    value={broadsheetSection}
                    onChange={e => setBroadsheetSection(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 bg-white"
                  >
                    {getSectionsForClass(broadsheetClass, db.classes, db.sections).map(secName => (
                      <option key={secName} value={secName}>
                        Section {secName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Session</label>
                <select
                  value={broadsheetSession}
                  onChange={e => setBroadsheetSession(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 bg-white"
                >
                  {db.sessions.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Term</label>
                <select
                  value={broadsheetTerm}
                  onChange={e => setBroadsheetTerm(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 bg-white"
                >
                  {db.terms.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <button
                onClick={handleExportBroadsheet}
                className="flex-1 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold py-2.5 px-3 rounded-lg transition shadow flex items-center justify-center space-x-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Export Broadsheet</span>
              </button>

              <button
                onClick={handleExportAttendance}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2.5 px-3 rounded-lg transition shadow flex items-center justify-center space-x-1.5"
              >
                <CalendarCheck className="w-4 h-4" />
                <span>Export Attendance</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
