import React, { useState, useEffect, useRef } from 'react';
import {
  AppDatabase,
  AssessmentRecord,
  SubjectScore,
  NavigationTab,
  UserAccount,
  Student,
  AttendanceRecord,
} from '../types';
import { calculateGrade, rankAssessments } from '../utils/ranking';
import {
  downloadAssessmentSheetTemplate,
  parseAndValidateAssessmentSpreadsheet,
  AssessmentSheetImportResult,
} from '../utils/excel';
import { ConfirmModal } from './ConfirmModal';
import { getApplicableSubjectsForClass } from '../utils/subjectMapping';
import { getSectionsForClass } from '../utils/classSections';
import {
  Save,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Calculator,
  User,
  Eye,
  Lock,
  FileSpreadsheet,
  Download,
  Upload,
  Sparkles,
  X,
  BookOpen,
} from 'lucide-react';

interface AssessmentEntryProps {
  db: AppDatabase;
  currentUser?: UserAccount;
  initialStudentId?: string;
  initialClass?: string;
  initialSection?: string;
  onSaveAssessment: (record: AssessmentRecord) => void;
  onImportAssessmentSheet?: (
    newStudents: Student[],
    newAssessments: AssessmentRecord[],
    newAttendance: AttendanceRecord[],
    detectedClasses: string[],
    detectedSections: string[]
  ) => void;
  setActiveTab: (tab: NavigationTab) => void;
  onSelectReportStudent: (studentId: string) => void;
}

export const AssessmentEntry: React.FC<AssessmentEntryProps> = ({
  db,
  currentUser,
  initialStudentId,
  initialClass,
  initialSection,
  onSaveAssessment,
  onImportAssessmentSheet,
  setActiveTab,
  onSelectReportStudent,
}) => {
  const isTeacher = currentUser?.role === 'teacher';
  const teacherClass = currentUser?.assignedClass;
  const teacherSection = currentUser?.assignedSection;

  // Dropdowns
  const [session, setSession] = useState<string>(
    currentUser?.assignedSession || db.settings.currentSession || db.sessions[0] || '2026/2027'
  );
  const [term, setTerm] = useState<string>(
    db.settings.currentTerm || db.terms[0] || '1st Term'
  );
  const [className, setClassName] = useState<string>(
    isTeacher && teacherClass
      ? teacherClass
      : (initialClass || db.classes[0]?.name || 'Nursery One')
  );

  // Applicable sections for this specific class (not all classes have A and B)
  const classSections = React.useMemo(() => {
    return getSectionsForClass(className, db.classes, db.sections);
  }, [className, db.classes, db.sections]);

  const [section, setSection] = useState<string>(
    isTeacher && teacherSection
      ? teacherSection
      : (initialSection && classSections.includes(initialSection)
          ? initialSection
          : (classSections[0] || 'A'))
  );

  // Synchronize section if current section is not valid for this class
  useEffect(() => {
    if (classSections.length > 0 && !classSections.includes(section)) {
      setSection(classSections[0]);
    }
  }, [className, classSections]);

  // Available students in current class and section
  const eligibleStudents = db.students.filter(
    s => s.className === className && s.section === section && s.status === 'Active'
  );

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId || (eligibleStudents[0]?.studentId || '')
  );

  // Synchronize when class/section change
  useEffect(() => {
    if (eligibleStudents.length > 0) {
      if (!eligibleStudents.some(s => s.studentId === selectedStudentId)) {
        setSelectedStudentId(eligibleStudents[0].studentId);
      }
    } else {
      setSelectedStudentId('');
    }
  }, [className, section, db.students]);

  // Selected student details
  const selectedStudent = db.students.find(s => s.studentId === selectedStudentId);

  // Assessment entry form state
  const [subjectScores, setSubjectScores] = useState<SubjectScore[]>([]);
  const [daysOpened, setDaysOpened] = useState<number>(90);
  const [daysPresent, setDaysPresent] = useState<number>(85);
  const [psychomotorRatings, setPsychomotorRatings] = useState<Record<string, string>>({});
  const [formTeacherName, setFormTeacherName] = useState<string>('Aisha Muhammad Ardo');
  const [formTeacherComment, setFormTeacherComment] = useState<string>(
    'Good academic progress and exemplary conduct.'
  );
  const [promotionRemark, setPromotionRemark] = useState<string>('PASS & PROMOTED');
  const [schoolCloses, setSchoolCloses] = useState<string>('24th Dhul Hijjah 1447 / 10th June 2026');
  const [nextTermBegins, setNextTermBegins] = useState<string>('04th Muharram 1448 / 20th July 2026');
  const [nextTermFees, setNextTermFees] = useState<string>('₦ 16,000');

  // Notification / Validation message
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(
    null
  );

  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  } | null>(null);

  // Spreadsheet upload state
  const [isUploadingSheet, setIsUploadingSheet] = useState(false);
  const [sheetImportResult, setSheetImportResult] = useState<AssessmentSheetImportResult | null>(null);
  const sheetFileInputRef = useRef<HTMLInputElement>(null);

  // Curriculum Guard: Only active subjects applicable to this class
  const applicableSubjects = React.useMemo(() => {
    return getApplicableSubjectsForClass(db.subjects, className, db.classes);
  }, [db.subjects, db.classes, className]);

  const handleDownloadClassTemplate = () => {
    downloadAssessmentSheetTemplate(db, className, section);
  };

  const handleSheetFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingSheet(true);
    setSheetImportResult(null);
    try {
      const result = await parseAndValidateAssessmentSpreadsheet(file, db, session, term, className, section);
      setSheetImportResult(result);
    } catch (err: any) {
      alert(`Error reading assessment sheet: ${err.message || 'Invalid format'}`);
    } finally {
      setIsUploadingSheet(false);
      if (sheetFileInputRef.current) sheetFileInputRef.current.value = '';
    }
  };

  const handleConfirmSheetImport = () => {
    if (!sheetImportResult || !onImportAssessmentSheet) return;
    onImportAssessmentSheet(
      sheetImportResult.newStudentsToEnroll,
      sheetImportResult.assessmentRecords,
      sheetImportResult.attendanceRecords,
      sheetImportResult.detectedClasses,
      sheetImportResult.detectedSections
    );
    setNotification({
      text: `Imported successfully! Auto-enrolled ${sheetImportResult.newStudentsToEnroll.length} new student(s) and recorded ${sheetImportResult.assessmentRecords.length} assessments.`,
      type: 'success',
    });
    setSheetImportResult(null);
  };

  // Auto-fill or initialize scores when student, session, or term changes
  useEffect(() => {
    if (!selectedStudentId) {
      setSubjectScores([]);
      return;
    }

    // Look for existing assessment record
    const existing = db.assessments.find(
      a =>
        a.studentId === selectedStudentId &&
        a.academicSession === session &&
        a.term === term
    );

    if (existing) {
      // STRICT CURRICULUM GUARD: Filter existing scores so only subjects assigned to this class are active
      const applicableSubIds = new Set(applicableSubjects.map(s => s.id));
      const applicableSubNames = new Set(applicableSubjects.map(s => s.name.toLowerCase().trim()));

      const validScores = (existing.subjectScores || []).filter(score =>
        applicableSubIds.has(score.subjectId) || applicableSubNames.has(score.subjectName.toLowerCase().trim())
      );

      // Ensure any applicable subject for this class missing from the existing record is added so the teacher can grade it
      const finalScores: SubjectScore[] = [...validScores];
      applicableSubjects.forEach(sub => {
        const alreadyPresent = finalScores.some(
          sc => sc.subjectId === sub.id || sc.subjectName.toLowerCase().trim() === sub.name.toLowerCase().trim()
        );
        if (!alreadyPresent) {
          finalScores.push({
            subjectId: sub.id,
            subjectName: sub.name,
            arabicName: sub.arabicName,
            ca1: 0,
            ca2: 0,
            exam: 0,
            total: 0,
            grade: 'F',
            position: '-',
          });
        }
      });

      setSubjectScores(finalScores);
      setDaysOpened(existing.daysOpened ?? 90);
      setDaysPresent(existing.daysPresent ?? 85);
      setPsychomotorRatings(existing.psychomotorRatings || {});
      setFormTeacherName(existing.formTeacherName || 'Aisha Muhammad Ardo');
      setFormTeacherComment(existing.formTeacherComment || 'Good academic progress.');
      setPromotionRemark(existing.promotionRemark || 'PASS & PROMOTED');
      setSchoolCloses(existing.schoolCloses || '24th Dhul Hijjah 1447 / 10th June 2026');
      setNextTermBegins(existing.nextTermBegins || '04th Muharram 1448 / 20th July 2026');
      setNextTermFees(existing.nextTermFees || '₦ 16,000');
    } else {
      // Initialize with ONLY active subjects assigned to this class
      const initialScores: SubjectScore[] = applicableSubjects.map(sub => ({
        subjectId: sub.id,
        subjectName: sub.name,
        arabicName: sub.arabicName,
        ca1: 0,
        ca2: 0,
        exam: 0,
        total: 0,
        grade: 'F',
        position: '-',
      }));
      setSubjectScores(initialScores);

      // Default psychomotor
      const defaultPsy: Record<string, string> = {};
      db.psychomotorItems.forEach(p => {
        defaultPsy[p.id] = 'A';
      });
      setPsychomotorRatings(defaultPsy);
    }
  }, [selectedStudentId, session, term, className, db.assessments, db.subjects, db.classes, db.psychomotorItems, applicableSubjects]);

  // Handle score change with strict max limit validation
  const handleScoreChange = (
    index: number,
    field: 'ca1' | 'ca2' | 'exam',
    valString: string
  ) => {
    const val = valString === '' ? 0 : Number(valString);
    if (isNaN(val) || val < 0) return;

    let maxAllowed = 100;
    if (field === 'ca1') maxAllowed = db.settings.ca1Max;
    if (field === 'ca2') maxAllowed = db.settings.ca2Max;
    if (field === 'exam') maxAllowed = db.settings.examMax;

    if (val > maxAllowed) {
      setNotification({
        text: `Score cannot exceed maximum of ${maxAllowed} for ${field.toUpperCase()}`,
        type: 'error',
      });
      return;
    }

    setSubjectScores(prev => {
      const updated = [...prev];
      const current = { ...updated[index], [field]: val };

      // Recalculate total and grade
      const total = Number(current.ca1 || 0) + Number(current.ca2 || 0) + Number(current.exam || 0);
      const { grade } = calculateGrade(total, db.gradingBoundaries);

      current.total = total;
      current.grade = grade;
      updated[index] = current;
      return updated;
    });
  };

  // Quick preset Islamic school comments
  const teacherCommentPresets = [
    'Outstanding recitation and exemplary Islamic conduct. Keep it up!',
    'A very intelligent, respectful and disciplined student. Well done.',
    'Good academic progress. More effort needed in memorization revision.',
    'Satisfactory performance. Advised to revise Arabic and Qira’a daily at home.',
    'Needs extra parental guidance, punctuality and regular home revision.',
    'Shows remarkable improvement in Qur’an recitation and Islamic ethics.',
  ];

  // Save assessment record
  const handleSave = () => {
    if (!selectedStudent) {
      setNotification({ text: 'Please select a student first', type: 'error' });
      return;
    }

    // STRICT CURRICULUM GUARD: Filter out any subjects not applicable to this class
    const applicableSubIds = new Set(applicableSubjects.map(s => s.id));
    const applicableSubNames = new Set(applicableSubjects.map(s => s.name.toLowerCase().trim()));
    const validScoresToSave = subjectScores.filter(
      s => applicableSubIds.has(s.subjectId) || applicableSubNames.has(s.subjectName.toLowerCase().trim())
    );

    const totalScore = validScoresToSave.reduce((sum, s) => sum + (s.total || 0), 0);
    const finalAverage =
      validScoresToSave.length > 0
        ? Math.round((totalScore / validScoresToSave.length) * 10) / 10
        : 0;
    const daysAbsent = Math.max(0, daysOpened - daysPresent);

    const assessmentRecord: AssessmentRecord = {
      id: `asm-${selectedStudent.studentId}-${session.replace('/', '-')}-${term.replace(/\s+/g, '-')}`,
      studentId: selectedStudent.studentId,
      academicSession: session,
      term,
      className,
      section,
      subjectScores: validScoresToSave,
      totalScore,
      finalAverage,
      daysOpened,
      daysPresent,
      daysAbsent,
      psychomotorRatings,
      formTeacherName,
      formTeacherComment,
      promotionRemark,
      schoolCloses,
      nextTermBegins,
      nextTermFees,
      updatedAt: new Date().toISOString(),
    };

    setConfirmModalConfig({
      isOpen: true,
      title: 'Confirm Save Assessment',
      message: `Are you sure you want to save and recalculate marks for "${selectedStudent.name}"?`,
      details: `Student: ${selectedStudent.name} (${selectedStudent.studentId}) • Total: ${totalScore} • Average: ${finalAverage}% • Subjects: ${subjectScores.length}`,
      variant: 'primary',
      confirmText: 'Yes, Save Assessment',
      onConfirm: () => {
        onSaveAssessment(assessmentRecord);
        setNotification({
          text: `Assessment for ${selectedStudent.name} saved and ranked successfully!`,
          type: 'success',
        });
        setTimeout(() => setNotification(null), 3500);
        setConfirmModalConfig(null);
      },
    });
  };

  // Fast Student Navigation (Previous / Next)
  const currentStudentIndex = eligibleStudents.findIndex(
    s => s.studentId === selectedStudentId
  );

  const handlePrevStudent = () => {
    if (currentStudentIndex > 0) {
      setSelectedStudentId(eligibleStudents[currentStudentIndex - 1].studentId);
    }
  };

  const handleNextStudent = () => {
    if (currentStudentIndex < eligibleStudents.length - 1) {
      setSelectedStudentId(eligibleStudents[currentStudentIndex + 1].studentId);
    }
  };

  // Computed summary
  const totalScoreCalc = subjectScores.reduce((sum, s) => sum + (s.total || 0), 0);
  const finalAverageCalc =
    subjectScores.length > 0 ? Math.round((totalScoreCalc / subjectScores.length) * 10) / 10 : 0;
  const daysAbsentCalc = Math.max(0, daysOpened - daysPresent);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Assessment &amp; Marks Entry</h2>
          <p className="text-xs text-slate-500">
            Enter cognitive CA &amp; Exam scores, attendance, psychomotor ratings, and teacher remarks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadClassTemplate}
            className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
            title="Download Excel Assessment Template with Embedded Guards"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Template</span>
          </button>

          <input
            type="file"
            ref={sheetFileInputRef}
            onChange={handleSheetFileChange}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />

          <button
            onClick={() => sheetFileInputRef.current?.click()}
            disabled={isUploadingSheet}
            className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
            title="Upload filled Assessment Sheet (Auto-enrolls new students)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isUploadingSheet ? 'Reading...' : 'Upload Sheet'}</span>
          </button>

          {selectedStudent && (
            <button
              onClick={() => onSelectReportStudent(selectedStudent.studentId)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center space-x-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          )}

          <button
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
          >
            <Save className="w-4 h-4" />
            <span>Save Assessment</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center space-x-2 ${
            notification.type === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Selector Ribbon */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Session
            </label>
            <select
              value={session}
              onChange={e => setSession(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded p-2 bg-slate-50 focus:bg-white"
            >
              {db.sessions.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Term</label>
            <select
              value={term}
              onChange={e => setTerm(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded p-2 bg-slate-50 focus:bg-white"
            >
              {db.terms.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              {isTeacher ? 'Class (Locked)' : 'Class'}
            </label>
            {isTeacher ? (
              <div className="w-full text-xs font-bold border border-amber-300 rounded p-2 bg-amber-50 text-amber-900 flex items-center justify-between">
                <span>{className}</span>
                <Lock className="w-3.5 h-3.5 text-amber-600" />
              </div>
            ) : (
              <select
                value={className}
                onChange={e => setClassName(e.target.value)}
                className="w-full text-xs font-semibold border border-slate-300 rounded p-2 bg-slate-50 focus:bg-white text-slate-900"
              >
                {db.classes.map(c => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              {isTeacher && teacherSection ? 'Section (Locked)' : 'Section'}
            </label>
            {isTeacher && teacherSection ? (
              <div className="w-full text-xs font-bold border border-amber-300 rounded p-2 bg-amber-50 text-amber-900 flex items-center justify-between">
                <span>Section {section}</span>
                <Lock className="w-3.5 h-3.5 text-amber-600" />
              </div>
            ) : (
              <select
                value={section}
                onChange={e => setSection(e.target.value)}
                className="w-full text-xs font-semibold border border-slate-300 rounded p-2 bg-slate-50 focus:bg-white text-slate-900"
              >
                {classSections.map(secName => (
                  <option key={secName} value={secName}>
                    Section {secName}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Student Selector & Stepper */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 flex items-center space-x-2">
            <User className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <label className="text-xs font-bold text-slate-700 uppercase whitespace-nowrap">
              Select Student:
            </label>
            <select
              value={selectedStudentId}
              onChange={e => setSelectedStudentId(e.target.value)}
              className="flex-1 text-xs font-bold border border-slate-300 rounded p-2 bg-slate-50 focus:bg-white text-slate-900"
            >
              {eligibleStudents.length === 0 ? (
                <option value="">No students found in this class</option>
              ) : (
                eligibleStudents.map((s, idx) => (
                  <option key={s.id} value={s.studentId}>
                    {idx + 1}. {s.name} ({s.studentId})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Previous / Next Stepper buttons for grading speed */}
          <div className="flex items-center space-x-1.5 self-end sm:self-auto">
            <button
              onClick={handlePrevStudent}
              disabled={currentStudentIndex <= 0}
              className="p-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition flex items-center text-xs"
              title="Previous Student"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-1 font-semibold">Prev</span>
            </button>
            <span className="text-xs font-mono font-bold text-slate-500 px-2">
              {eligibleStudents.length > 0 ? `${currentStudentIndex + 1} of ${eligibleStudents.length}` : '0 of 0'}
            </span>
            <button
              onClick={handleNextStudent}
              disabled={currentStudentIndex >= eligibleStudents.length - 1}
              className="p-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition flex items-center text-xs"
              title="Next Student"
            >
              <span className="hidden sm:inline mr-1 font-semibold">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Selected Student Banner & Live Calc Overview */}
      {selectedStudent && (
        <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs bg-emerald-700 text-emerald-100 px-2 py-0.5 rounded font-mono">
                {selectedStudent.studentId}
              </span>
              <span className="text-xs text-slate-400">{selectedStudent.admissionNumber}</span>
              <span className="text-xs bg-blue-800 text-white px-2 py-0.5 rounded">
                {selectedStudent.gender}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mt-1">{selectedStudent.name}</h3>
            <p className="text-xs text-slate-300">
              Class: {className} ({section}) &bull; Parent: {selectedStudent.parentName || 'N/A'}{' '}
              {selectedStudent.parentPhone ? `(${selectedStudent.parentPhone})` : ''}
            </p>
          </div>

          <div className="flex items-center space-x-4 bg-slate-800/80 p-3 rounded-lg border border-slate-700">
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Score</span>
              <span className="text-xl font-black text-white">{totalScoreCalc}</span>
            </div>
            <div className="h-8 w-px bg-slate-700" />
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Final Avg</span>
              <span className="text-xl font-black text-emerald-400">{finalAverageCalc}%</span>
            </div>
            <div className="h-8 w-px bg-slate-700" />
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Subjects</span>
              <span className="text-xl font-black text-blue-400">{subjectScores.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Cognitive Marks Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
              <Calculator className="w-4 h-4 text-emerald-600" />
              <span>Cognitive Domain (Subjects &amp; Examination)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Score limits: 1st CA (Max {db.settings.ca1Max}%), 2nd CA (Max {db.settings.ca2Max}%), Exam (Max {db.settings.examMax}%)
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                applicableSubjects.length > 0
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>
                {applicableSubjects.length > 0
                  ? `${applicableSubjects.length} subjects assigned to ${className}`
                  : `0 subjects assigned to ${className}`}
              </span>
            </span>
            {currentUser?.role !== 'teacher' && (
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="text-[11px] font-semibold text-blue-800 hover:text-blue-950 underline px-1 py-0.5"
                title="Configure class subjects in Settings"
              >
                Configure
              </button>
            )}
          </div>
        </div>

        {applicableSubjects.length === 0 && (
          <div className="p-6 m-4 text-center bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
            <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
            <p className="font-bold text-sm">No Curriculum Subjects Assigned to {className}</p>
            <p className="text-slate-600 mt-1 max-w-md mx-auto">
              Teachers cannot record marks for this class because no subjects are linked to <strong>{className}</strong> in settings.
            </p>
            {currentUser?.role !== 'teacher' && (
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="mt-3 px-3 py-1.5 bg-blue-900 text-white rounded-lg font-semibold hover:bg-blue-800 transition"
              >
                Assign Subjects in Settings &rarr; Subject Allocation
              </button>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4 w-44">Subject (English)</th>
                <th className="py-3 px-4 w-32 text-right">المادة (Arabic)</th>
                <th className="py-3 px-3 text-center w-28">
                  1st CA (0-{db.settings.ca1Max})
                </th>
                <th className="py-3 px-3 text-center w-28">
                  2nd CA (0-{db.settings.ca2Max})
                </th>
                <th className="py-3 px-3 text-center w-28">
                  Exam (0-{db.settings.examMax})
                </th>
                <th className="py-3 px-3 text-center w-24">Total (100)</th>
                <th className="py-3 px-3 text-center w-20">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subjectScores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No subjects active. Add subjects in Settings.
                  </td>
                </tr>
              ) : (
                subjectScores.map((score, index) => (
                  <tr key={score.subjectId || index} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      {score.subjectName}
                    </td>

                    <td className="py-2.5 px-4 font-amiri font-bold text-base text-right text-slate-800">
                      {score.arabicName}
                    </td>

                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max={db.settings.ca1Max}
                        value={score.ca1 || ''}
                        onChange={e => handleScoreChange(index, 'ca1', e.target.value)}
                        className="w-20 text-center font-bold text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        placeholder="0"
                      />
                    </td>

                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max={db.settings.ca2Max}
                        value={score.ca2 || ''}
                        onChange={e => handleScoreChange(index, 'ca2', e.target.value)}
                        className="w-20 text-center font-bold text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        placeholder="0"
                      />
                    </td>

                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max={db.settings.examMax}
                        value={score.exam || ''}
                        onChange={e => handleScoreChange(index, 'exam', e.target.value)}
                        className="w-20 text-center font-bold text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        placeholder="0"
                      />
                    </td>

                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 bg-slate-50/80">
                      {score.total}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-xs font-black bg-slate-900 text-white">
                        {score.grade}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side-by-side: Attendance & Psychomotor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Attendance */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Term Attendance</h3>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Days Opened
              </label>
              <input
                type="number"
                min="0"
                value={daysOpened}
                onChange={e => setDaysOpened(Number(e.target.value) || 0)}
                className="w-full text-xs font-bold border border-slate-300 rounded p-2"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Days Present
              </label>
              <input
                type="number"
                min="0"
                max={daysOpened}
                value={daysPresent}
                onChange={e => setDaysPresent(Number(e.target.value) || 0)}
                className="w-full text-xs font-bold border border-slate-300 rounded p-2"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Days Absent
              </label>
              <input
                type="number"
                readOnly
                value={daysAbsentCalc}
                className="w-full text-xs font-bold border border-slate-200 bg-slate-100 rounded p-2 text-slate-700 cursor-not-allowed"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 italic">
            Days absent is automatically calculated (Opened - Present).
          </p>
        </div>

        {/* Psychomotor Domain */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Psychomotor / Behavioral Domain</h3>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {db.psychomotorItems.map(item => {
              const currentRating = psychomotorRatings[item.id] || 'A';
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded border border-slate-200 bg-slate-50"
                >
                  <span className="font-semibold text-slate-800 truncate pr-2">{item.name}</span>
                  <select
                    value={currentRating}
                    onChange={e =>
                      setPsychomotorRatings(prev => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                    className="text-xs font-bold border border-slate-300 rounded px-2 py-1 bg-white"
                  >
                    <option value="A">A (Excellent)</option>
                    <option value="B">B (Very Good)</option>
                    <option value="C">C (Good)</option>
                    <option value="D">D (Fair)</option>
                    <option value="E">E (Poor)</option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Form Teacher Information & Remarks */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900">
          Form Teacher Remarks &amp; School Term Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Promotion / General Remark
            </label>
            <select
              value={promotionRemark}
              onChange={e => setPromotionRemark(e.target.value)}
              className="w-full text-xs font-bold border border-slate-300 rounded p-2 bg-white text-slate-900"
            >
              <option value="PASS & PROMOTED">PASS & PROMOTED</option>
              <option value="PASS & REPEAT">PASS & REPEAT</option>
              <option value="PROMOTED ON TRIAL">PROMOTED ON TRIAL</option>
              <option value="EXCELLENT PERFORMANCE">EXCELLENT PERFORMANCE</option>
              <option value="WITHDRAWN">WITHDRAWN</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Form Teacher Name
            </label>
            <input
              type="text"
              value={formTeacherName}
              onChange={e => setFormTeacherName(e.target.value)}
              className="w-full text-xs font-semibold border border-slate-300 rounded p-2"
              placeholder="e.g. Aisha Muhammad Ardo"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-slate-700 uppercase">
              Form Teacher Comment
            </label>
            <div className="text-[11px] text-slate-400">Choose preset or write custom</div>
          </div>
          <input
            type="text"
            value={formTeacherComment}
            onChange={e => setFormTeacherComment(e.target.value)}
            className="w-full text-xs italic border border-slate-300 rounded p-2.5 focus:ring-1 focus:ring-blue-500"
            placeholder="Form teacher's qualitative evaluation..."
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {teacherCommentPresets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setFormTeacherComment(preset)}
                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded transition line-clamp-1 max-w-xs text-left"
              >
                &ldquo;{preset.slice(0, 38)}...&rdquo;
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              School Closes
            </label>
            <input
              type="text"
              value={schoolCloses}
              onChange={e => setSchoolCloses(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded p-2"
              placeholder="24th Dhul Hijjah 1447 / 10th June 2026"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Next Term Begins
            </label>
            <input
              type="text"
              value={nextTermBegins}
              onChange={e => setNextTermBegins(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded p-2"
              placeholder="04th Muharram 1448 / 20th July 2026"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Next Term School Fees
            </label>
            <input
              type="text"
              value={nextTermFees}
              onChange={e => setNextTermFees(e.target.value)}
              className="w-full text-xs font-bold border border-slate-300 rounded p-2"
              placeholder="₦ 16,000"
            />
          </div>
        </div>
      </div>

      {/* Bottom Save Bar */}
      <div className="flex items-center justify-end space-x-3 pb-8">
        <button
          onClick={() => setActiveTab('classes')}
          className="text-xs font-semibold px-4 py-2 text-slate-600 hover:bg-slate-100 rounded"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold px-6 py-2.5 rounded-lg transition shadow flex items-center space-x-1.5"
        >
          <Save className="w-4 h-4" />
          <span>Save Assessment &amp; Recalculate Class Ranks</span>
        </button>
      </div>

      {/* MODAL: ASSESSMENT SHEET IMPORT PREVIEW & AUTO-ENROLL CONFIRMATION */}
      {sheetImportResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative animate-in fade-in zoom-in-95 space-y-4 max-h-[90vh] flex flex-col">
            <button
              onClick={() => setSheetImportResult(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center space-x-2 text-blue-900 mb-1">
                <FileSpreadsheet className="w-5 h-5" />
                <h3 className="text-base font-bold">Assessment Sheet Upload Preview</h3>
              </div>
              <p className="text-xs text-slate-500">
                Verify auto-enrolled students and assessment marks before adding to the portal.
              </p>
            </div>

            {/* Statistic Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Rows Read</span>
                <span className="text-lg font-black text-slate-900">{sheetImportResult.totalRows}</span>
              </div>

              <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-center ring-2 ring-emerald-500/20">
                <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                  ★ Auto-Enroll
                </span>
                <span className="text-lg font-black text-emerald-700">
                  +{sheetImportResult.newStudentsToEnroll.length}
                </span>
                <span className="text-[9px] text-emerald-600 block">New Students</span>
              </div>

              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-center">
                <span className="text-[10px] font-bold text-blue-700 uppercase block">Existing</span>
                <span className="text-lg font-black text-blue-800">
                  {sheetImportResult.existingStudentsMatched.length}
                </span>
                <span className="text-[9px] text-blue-600 block">Matched</span>
              </div>

              <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-center">
                <span className="text-[10px] font-bold text-purple-700 uppercase block">Assessments</span>
                <span className="text-lg font-black text-purple-800">
                  {sheetImportResult.assessmentRecords.length}
                </span>
                <span className="text-[9px] text-purple-600 block">Ranked</span>
              </div>
            </div>

            {/* Informative Auto-Enroll Callout */}
            {sheetImportResult.newStudentsToEnroll.length > 0 && (
              <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
                <div className="font-bold flex items-center space-x-1.5 text-emerald-900">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>
                    {sheetImportResult.newStudentsToEnroll.length} New Student(s) Will Be Automatically Enrolled:
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  These students were found in your sheet but not in the database. Clicking &ldquo;Confirm &amp; Import&rdquo; will automatically create them as active students. You can complete their profile (parents, phone, DOB, address) anytime later under <strong>Students</strong>.
                </p>
              </div>
            )}

            {/* Table of Students & Scores */}
            <div className="border border-slate-200 rounded-xl overflow-hidden flex-1 overflow-y-auto max-h-56">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Student Name</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Class &amp; Arm</th>
                    <th className="py-2 px-3 text-center">Subjects</th>
                    <th className="py-2 px-3 text-center">Average</th>
                    <th className="py-2 px-3 text-center">Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {sheetImportResult.assessmentRecords.map((rec, idx) => {
                    const isNew = sheetImportResult.newStudentsToEnroll.some(s => s.studentId === rec.studentId);
                    const stu =
                      sheetImportResult.newStudentsToEnroll.find(s => s.studentId === rec.studentId) ||
                      sheetImportResult.existingStudentsMatched.find(s => s.studentId === rec.studentId) ||
                      db.students.find(s => s.studentId === rec.studentId);

                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900">{stu?.name || rec.studentId}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {stu?.admissionNumber || stu?.studentId}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          {isNew ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <span>★ Auto-Enroll</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                              <span>Existing</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {rec.className} {rec.section ? `(${rec.section})` : ''}
                        </td>
                        <td className="py-2 px-3 text-center">{rec.subjectScores.length}</td>
                        <td className="py-2 px-3 text-center font-bold text-blue-700">{rec.finalAverage}%</td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-700">
                          {rec.finalPosition || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSheetImportResult(null)}
                className="text-xs font-semibold px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmSheetImport}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-5 rounded-lg transition shadow flex items-center space-x-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>
                  Confirm &amp; Import (+{sheetImportResult.newStudentsToEnroll.length} Students Auto-Enrolled)
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmModalConfig && (
        <ConfirmModal
          isOpen={confirmModalConfig.isOpen}
          title={confirmModalConfig.title}
          message={confirmModalConfig.message}
          details={confirmModalConfig.details}
          confirmText={confirmModalConfig.confirmText}
          variant={confirmModalConfig.variant}
          onConfirm={confirmModalConfig.onConfirm}
          onCancel={() => setConfirmModalConfig(null)}
        />
      )}
    </div>
  );
};
