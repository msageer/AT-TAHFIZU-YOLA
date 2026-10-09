import React, { useState, useEffect, useMemo } from 'react';
import { AppDatabase, Student, AssessmentRecord, UserAccount } from '../types';
import { computeClassStatistics, rankAssessments } from '../utils/ranking';
import { getSectionsForClass, formatClassWithSection } from '../utils/classSections';
import { exportAssessmentBroadsheetToExcel } from '../utils/excel';
import { ReportSheet } from './ReportSheet';
import {
  FileText,
  Printer,
  Eye,
  X,
  Filter,
  CheckSquare,
  Square,
  AlertCircle,
  Download,
  Lock,
  Layers,
} from 'lucide-react';

interface ReportCenterProps {
  db: AppDatabase;
  currentUser?: UserAccount;
  initialStudentId?: string;
}

export const ReportCenter: React.FC<ReportCenterProps> = ({
  db,
  currentUser,
  initialStudentId,
}) => {
  const isTeacher = currentUser?.role === 'teacher';
  const teacherClass = currentUser?.assignedClass;
  const teacherSection = currentUser?.assignedSection;

  // Filters
  const [session, setSession] = useState<string>(
    currentUser?.assignedSession || db.settings.currentSession || db.sessions[0] || '2026/2027'
  );
  const [term, setTerm] = useState<string>(
    db.settings.currentTerm || db.terms[0] || '1st Term'
  );
  const [generationMode, setGenerationMode] = useState<'single-class' | 'multi-class'>(
    'single-class'
  );

  // Single Class Mode
  const [selectedClass, setSelectedClass] = useState<string>(
    isTeacher && teacherClass ? teacherClass : (db.classes[0]?.name || 'Nursery One')
  );

  // Applicable arms/sections for selected class (classes without A and B have NO section)
  const classSections = useMemo(() => {
    return getSectionsForClass(selectedClass, db.classes, db.sections);
  }, [selectedClass, db.classes, db.sections]);

  const hasSections = classSections.length > 0;

  const [selectedSection, setSelectedSection] = useState<string>(
    hasSections
      ? (isTeacher && teacherSection ? teacherSection : 'ALL')
      : ''
  );

  // Synchronize section if current selection is not valid for this class
  useEffect(() => {
    if (hasSections) {
      if (selectedSection !== 'ALL' && !classSections.includes(selectedSection)) {
        setSelectedSection('ALL');
      }
    } else {
      setSelectedSection('');
    }
  }, [selectedClass, classSections, selectedSection, hasSections]);

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId || 'ALL'
  );

  // Multi-Class Mode
  const [selectedClassesMulti, setSelectedClassesMulti] = useState<string[]>([
    db.classes[0]?.name || 'Nursery One',
  ]);

  // Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [exportNotification, setExportNotification] = useState<string | null>(null);

  // Toggle multi-class checkboxes
  const handleToggleClassMulti = (clsName: string) => {
    setSelectedClassesMulti(prev =>
      prev.includes(clsName) ? prev.filter(c => c !== clsName) : [...prev, clsName]
    );
  };

  const handleSelectAllClasses = () => {
    if (selectedClassesMulti.length === db.classes.length) {
      setSelectedClassesMulti([]);
    } else {
      setSelectedClassesMulti(db.classes.map(c => c.name));
    }
  };

  // Get eligible students for the current single-class filter (including all arms when selectedSection is ALL)
  const singleClassStudents = db.students.filter(s => {
    if (s.className !== selectedClass || s.status !== 'Active') return false;
    if (hasSections) {
      if (selectedSection && selectedSection !== 'ALL') {
        return s.section === selectedSection;
      }
      return true; // When 'ALL', include all students across arms (hundreds of students)
    }
    return true; // Classes without A and B have NO section
  });

  // Collect reports to generate
  let reportsToGenerate: Array<{
    student: Student;
    assessment: AssessmentRecord;
    stats: any;
  }> = [];

  if (generationMode === 'single-class') {
    if (hasSections && selectedSection === 'ALL') {
      // Group by arm/section so students in Arm A and Arm B are each ranked accurately with their respective Form Masters!
      const arms = classSections.length > 0 ? classSections : [''];
      arms.forEach(armName => {
        const rawArmAssessments = db.assessments.filter(
          a =>
            a.className === selectedClass &&
            (!armName || a.section === armName) &&
            a.academicSession === session &&
            a.term === term
        );
        const rankedArmAssessments = rankAssessments(rawArmAssessments);
        const armStats = computeClassStatistics(rankedArmAssessments);

        const targetStudents =
          selectedStudentId === 'ALL'
            ? singleClassStudents.filter(s => !armName || s.section === armName)
            : singleClassStudents.filter(s => s.studentId === selectedStudentId && (!armName || s.section === armName));

        targetStudents.forEach(student => {
          const assessment =
            rankedArmAssessments.find(a => a.studentId === student.studentId) ||
            rawArmAssessments.find(a => a.studentId === student.studentId);
          if (assessment) {
            reportsToGenerate.push({
              student,
              assessment,
              stats: armStats,
            });
          }
        });
      });
    } else {
      // Specific section or single stream class
      const rawClassAssessments = db.assessments.filter(a => {
        if (a.className !== selectedClass || a.academicSession !== session || a.term !== term) return false;
        if (hasSections && selectedSection && selectedSection !== 'ALL') {
          return a.section === selectedSection;
        }
        return true;
      });
      const rankedClassAssessments = rankAssessments(rawClassAssessments);
      const classStats = computeClassStatistics(rankedClassAssessments);

      const targetStudents =
        selectedStudentId === 'ALL'
          ? singleClassStudents
          : singleClassStudents.filter(s => s.studentId === selectedStudentId);

      targetStudents.forEach(student => {
        const assessment = rankedClassAssessments.find(a => a.studentId === student.studentId);
        if (assessment) {
          reportsToGenerate.push({
            student,
            assessment,
            stats: classStats,
          });
        }
      });
    }
  } else {
    // Multi-Class mode: gather for all selected classes (supports hundreds of reports)
    selectedClassesMulti.forEach(clsName => {
      // Find all sections that have students in this class
      const classStudents = db.students.filter(
        s => s.className === clsName && s.status === 'Active'
      );
      const uniqueSections = Array.from(new Set(classStudents.map(s => s.section)));

      uniqueSections.forEach(secName => {
        const rawClassAssessments = db.assessments.filter(
          a =>
            a.className === clsName &&
            a.section === secName &&
            a.academicSession === session &&
            a.term === term
        );
        const rankedClassAssessments = rankAssessments(rawClassAssessments);
        const classStats = computeClassStatistics(rankedClassAssessments);

        const secStudents = classStudents.filter(s => s.section === secName);
        secStudents.forEach(student => {
          const assessment = rankedClassAssessments.find(a => a.studentId === student.studentId);
          if (assessment) {
            reportsToGenerate.push({
              student,
              assessment,
              stats: classStats,
            });
          }
        });
      });
    });
  }

  // Dedicated state for printing single vs all vs batch ranges (hundreds of students)
  const [printSingleStudentId, setPrintSingleStudentId] = useState<string | null>(null);
  const [printRange, setPrintRange] = useState<{ start: number; end: number; label: string } | null>(null);

  // Trigger print for all currently selected report sheets (all hundreds)
  const handlePrintAll = () => {
    setPrintSingleStudentId(null);
    setPrintRange(null);
    setTimeout(() => {
      window.print();
    }, 50);
  };

  // Trigger batch print (e.g., 50 at a time for optimal browser printing when hundreds exist)
  const handlePrintBatch = (start: number, end: number, label: string) => {
    setPrintSingleStudentId(null);
    setPrintRange({ start, end, label });
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintRange(null);
      }, 500);
    }, 50);
  };

  // Trigger print for a specific individual student's report card
  const handlePrintSingle = (studentId?: string) => {
    if (!studentId || studentId === 'ALL') {
      handlePrintAll();
      return;
    }
    setPrintSingleStudentId(studentId);
    setPrintRange(null);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintSingleStudentId(null);
      }, 500);
    }, 50);
  };

  // Export all current reports (even if hundreds) to Excel Broadsheet
  const handleExportReportsToExcel = () => {
    if (reportsToGenerate.length === 0) return;
    const records = reportsToGenerate.map(r => r.assessment);
    const studentMap: Record<string, Student> = {};
    reportsToGenerate.forEach(r => {
      studentMap[r.student.studentId] = r.student;
    });

    const exportSectionLabel =
      generationMode === 'single-class'
        ? selectedSection === 'ALL' || !selectedSection
          ? 'All_Arms'
          : selectedSection
        : 'Multi_Classes';

    const exportClassName =
      generationMode === 'single-class' ? selectedClass : 'Selected_Classes';

    exportAssessmentBroadsheetToExcel(
      records,
      studentMap,
      exportClassName,
      exportSectionLabel,
      session,
      term
    );

    setExportNotification(`Successfully exported ${records.length} report broadsheet records to Excel!`);
    setTimeout(() => setExportNotification(null), 5000);
  };

  // Filter reports if single print or batch print is active
  const reportsToRender = useMemo(() => {
    if (printSingleStudentId) {
      return reportsToGenerate.filter(item => item.student.studentId === printSingleStudentId);
    }
    if (printRange) {
      return reportsToGenerate.slice(printRange.start, printRange.end);
    }
    return reportsToGenerate;
  }, [reportsToGenerate, printSingleStudentId, printRange]);

  // Compute batches of 50 for large student populations (hundreds)
  const printBatches = useMemo(() => {
    if (reportsToGenerate.length <= 30) return [];
    const batches: Array<{ start: number; end: number; label: string }> = [];
    const batchSize = 50;
    for (let i = 0; i < reportsToGenerate.length; i += batchSize) {
      const end = Math.min(i + batchSize, reportsToGenerate.length);
      batches.push({
        start: i,
        end,
        label: `Reports ${i + 1} - ${end}`,
      });
    }
    return batches;
  }, [reportsToGenerate.length]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Report Center &amp; Printing</h2>
          <p className="text-xs text-slate-500">
            Generate authentic A4 portrait Islamic school report sheets with cognitive domains, psychomotor ratings, and attendance. Fits strictly on single A4 pages.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportReportsToExcel}
            disabled={reportsToGenerate.length === 0}
            className="bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5 shadow cursor-pointer"
            title="Export all selected reports (hundreds) directly to Excel broadsheet"
          >
            <Download className="w-4 h-4" />
            <span>Export to Excel ({reportsToGenerate.length})</span>
          </button>
          <button
            onClick={() => setIsPreviewOpen(true)}
            disabled={reportsToGenerate.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center space-x-1.5 shadow cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span>Preview ({reportsToGenerate.length})</span>
          </button>
          <button
            onClick={handlePrintAll}
            disabled={reportsToGenerate.length === 0}
            className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition flex items-center space-x-1.5 shadow-md shadow-blue-900/20 active:scale-95 cursor-pointer"
            title="Print printer-friendly A4 portrait student report card(s)"
          >
            <Printer className="w-4 h-4" />
            <span>Print {reportsToGenerate.length > 1 ? `All Reports (${reportsToGenerate.length})` : 'Report Card'}</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4 no-print">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2 text-slate-800 font-semibold text-xs">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>Report Generation Selection Mode:</span>
          </div>

          {!isTeacher ? (
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
              <button
                onClick={() => setGenerationMode('single-class')}
                className={`px-3 py-1 rounded transition ${
                  generationMode === 'single-class'
                    ? 'bg-white text-blue-900 font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Single Class / Student
              </button>
              <button
                onClick={() => setGenerationMode('multi-class')}
                className={`px-3 py-1 rounded transition ${
                  generationMode === 'multi-class'
                    ? 'bg-white text-blue-900 font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Multiple Classes Batch
              </button>
            </div>
          ) : (
            <div className="px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 font-bold flex items-center space-x-1.5">
              <Lock className="w-3 h-3 text-amber-600" />
              <span>Assigned Class Report Mode</span>
            </div>
          )}
        </div>

        {/* Global Session & Term Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Academic Session
            </label>
            <select
              value={session}
              onChange={e => setSession(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 bg-slate-50"
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
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 bg-slate-50"
            >
              {db.terms.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* MODE 1: SINGLE CLASS / INDIVIDUAL STUDENT */}
        {generationMode === 'single-class' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                {isTeacher ? 'Class (Locked)' : 'Class'}
              </label>
              {isTeacher ? (
                <div className="w-full text-xs font-bold border border-amber-300 rounded-lg p-2 bg-amber-50 text-amber-900 flex items-center justify-between">
                  <span>{selectedClass}</span>
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                </div>
              ) : (
                <select
                  value={selectedClass}
                  onChange={e => {
                    const newCls = e.target.value;
                    setSelectedClass(newCls);
                    const validSecs = getSectionsForClass(newCls, db.classes, db.sections);
                    if (validSecs.length > 0) {
                      if (!validSecs.includes(selectedSection)) {
                        setSelectedSection(validSecs[0] || 'A');
                      }
                    } else {
                      setSelectedSection('');
                    }
                  }}
                  className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white"
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
                {isTeacher && teacherSection ? 'Arm / Section (Locked)' : 'Arm / Section'}
              </label>
              {!hasSections ? (
                <div className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2 bg-slate-100 text-slate-500 italic flex items-center justify-between">
                  <span>No Section (Entire Class)</span>
                </div>
              ) : isTeacher && teacherSection ? (
                <div className="w-full text-xs font-bold border border-amber-300 rounded-lg p-2 bg-amber-50 text-amber-900 flex items-center justify-between">
                  <span>Arm {selectedSection}</span>
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                </div>
              ) : (
                <select
                  value={selectedSection}
                  onChange={e => setSelectedSection(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white"
                >
                  <option value="ALL">All Arms / All Sections (Entire Class - Hundreds)</option>
                  {classSections.map(secName => {
                    const armCount = db.students.filter(
                      s => s.className === selectedClass && s.section === secName && s.status === 'Active'
                    ).length;
                    return (
                      <option key={secName} value={secName}>
                        Arm {secName} ({armCount} students)
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Student Selection
              </label>
              <div className="flex items-center space-x-2">
                <select
                  value={selectedStudentId}
                  onChange={e => setSelectedStudentId(e.target.value)}
                  className="flex-1 text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
                >
                  <option value="ALL">ALL STUDENTS IN THIS CLASS ({singleClassStudents.length})</option>
                  {singleClassStudents.map(s => (
                    <option key={s.id} value={s.studentId}>
                      {s.name} ({s.studentId})
                    </option>
                  ))}
                </select>
                {selectedStudentId !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => handlePrintSingle(selectedStudentId)}
                    disabled={reportsToGenerate.length === 0}
                    className="px-3 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition flex items-center space-x-1 shadow-sm flex-shrink-0 cursor-pointer"
                    title="Print this student's report card on single A4 page"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODE 2: MULTIPLE CLASSES BATCH SELECTION */}
        {generationMode === 'multi-class' && (
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase">
                Select Classes to Batch Print:
              </label>
              <button
                type="button"
                onClick={handleSelectAllClasses}
                className="text-xs text-blue-700 hover:underline font-semibold"
              >
                {selectedClassesMulti.length === db.classes.length ? 'Deselect All' : 'Select All Classes'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {db.classes.map(c => {
                const isChecked = selectedClassesMulti.includes(c.name);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleToggleClassMulti(c.name)}
                    className={`flex items-center space-x-2 p-2.5 rounded-lg border text-xs text-left transition ${
                      isChecked
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <span className="truncate">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {exportNotification && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-900 font-semibold flex items-center justify-between animate-in fade-in">
            <span>{exportNotification}</span>
            <button
              onClick={() => setExportNotification(null)}
              className="text-emerald-700 hover:text-emerald-900"
            >
              &times;
            </button>
          </div>
        )}

        {/* Selected Summary Info */}
        <div className="p-3.5 rounded-lg bg-blue-50/80 border border-blue-200 text-xs text-blue-900 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold">Ready to generate:</span>{' '}
              <strong className="text-emerald-700 font-black text-sm">{reportsToGenerate.length}</strong>{' '}
              student report sheet(s).
              {printRange && (
                <span className="ml-2 font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-300">
                  Currently Filtering: {printRange.label} (
                  <button
                    onClick={() => setPrintRange(null)}
                    className="underline hover:text-purple-900 cursor-pointer ml-1"
                  >
                    Show All
                  </button>
                  )
                </span>
              )}
            </div>
            <div className="text-[11px] text-blue-800 font-medium">
              Formatted strictly for single A4 portrait paper pages with zero multi-page spills.
            </div>
          </div>

          {/* Batch Print Selector for Large Classes (Hundreds of Reports) */}
          {printBatches.length > 0 && (
            <div className="pt-2 border-t border-blue-200/60 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-700 flex items-center mr-1">
                <Layers className="w-3.5 h-3.5 mr-1 text-blue-600" />
                Batch Print ({reportsToGenerate.length} total pages):
              </span>
              <button
                type="button"
                onClick={handlePrintAll}
                className={`px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                  !printRange
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-white text-blue-900 border border-blue-300 hover:bg-blue-50'
                }`}
              >
                Print All ({reportsToGenerate.length})
              </button>
              {printBatches.map(batch => (
                <button
                  key={batch.label}
                  type="button"
                  onClick={() => handlePrintBatch(batch.start, batch.end, batch.label)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                    printRange?.label === batch.label
                      ? 'bg-purple-700 text-white shadow-xs font-bold'
                      : 'bg-white text-purple-900 border border-purple-200 hover:bg-purple-50'
                  }`}
                  title={`Spool ${batch.label} to printer`}
                >
                  {batch.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* No Reports Notice */}
      {reportsToGenerate.length === 0 && (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 no-print">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <h4 className="font-bold text-slate-800">No Assessment Records Found</h4>
          <p className="text-xs text-slate-500 mt-1">
            There are no entered assessments for the selected class/student under {session} &bull; {term}.
          </p>
        </div>
      )}

      {/* Inline Preview / Print Render Area */}
      <div className="space-y-8 print:space-y-0">
        {reportsToRender.map((item, idx) => (
          <div key={item.student.id} className="report-sheet-page relative">
            {/* Header info bar on screen only */}
            <div className="no-print max-w-[200mm] mx-auto mb-2 flex items-center justify-between text-xs text-slate-600 bg-slate-100 p-2.5 rounded-lg border border-slate-200 shadow-sm">
              <span className="font-semibold">
                Report {idx + 1} of {reportsToRender.length}:{' '}
                <strong className="text-slate-900 font-bold">{item.student.name}</strong>{' '}
                <span className="text-slate-500">
                  ({formatClassWithSection(item.student.className, item.student.section, db.classes)})
                </span>
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handlePrintSingle(item.student.studentId)}
                  className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold px-3 py-1.5 rounded-md transition flex items-center space-x-1.5 shadow-sm active:scale-95"
                  title={`Print ${item.student.name}'s report sheet on a single A4 page`}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Report</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudentId(item.student.studentId);
                    setIsPreviewOpen(true);
                  }}
                  className="text-slate-700 hover:text-slate-900 hover:bg-white text-xs font-semibold px-2.5 py-1.5 rounded-md border border-slate-300 transition flex items-center space-x-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>
              </div>
            </div>

            {/* The Authentic Islamic School Report Sheet Component */}
            <ReportSheet
              settings={db.settings}
              student={item.student}
              assessment={item.assessment}
              stats={item.stats}
              gradingBoundaries={db.gradingBoundaries}
              psychomotorItems={db.psychomotorItems}
              classes={db.classes}
              users={db.users}
            />
          </div>
        ))}
      </div>

      {/* MODAL FULLSCREEN PREVIEW */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 overflow-y-auto no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-4 sm:p-6 relative max-h-[92vh] flex flex-col">
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  A4 Print-Ready Report Sheet Preview
                </h3>
                <p className="text-xs text-slate-500">
                  Showing {reportsToGenerate.length} report(s) matching authentic Islamic school format (single A4 page each).
                </p>
              </div>

              <div className="flex items-center space-x-2 mr-6">
                <button
                  onClick={handlePrintAll}
                  className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Report Sheet (A4)</span>
                </button>
              </div>
            </div>

            {/* Scrollable Preview Body */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-200 rounded-lg space-y-6">
              {reportsToGenerate.map(item => (
                <div key={item.student.id} className="shadow-lg">
                  <ReportSheet
                    settings={db.settings}
                    student={item.student}
                    assessment={item.assessment}
                    stats={item.stats}
                    gradingBoundaries={db.gradingBoundaries}
                    psychomotorItems={db.psychomotorItems}
                    classes={db.classes}
                    users={db.users}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 mt-3">
              <span className="text-xs text-slate-500">
                Tip: In browser print dialog, choose &quot;Save as PDF&quot; or select your printer.
              </span>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold px-4 py-2 rounded-lg"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
