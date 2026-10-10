import React, { useState, useEffect, useMemo } from 'react';
import { AppDatabase, Student, AssessmentRecord, UserAccount, NavigationTab } from '../types';
import { computeClassStatistics, rankAssessments } from '../utils/ranking';
import { getSectionsForClass, formatClassWithSection, getFormTeacherForClass } from '../utils/classSections';
import { exportAssessmentBroadsheetToExcel, matchCanonicalClass } from '../utils/excel';
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
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Hash,
  Check,
  ListChecks,
  TableProperties,
} from 'lucide-react';

interface ReportCenterProps {
  db: AppDatabase;
  currentUser?: UserAccount;
  initialStudentId?: string;
  onSelectAssessmentStudent?: (studentId: string, className: string, section: string) => void;
  setActiveTab?: (tab: NavigationTab) => void;
}

export const ReportCenter: React.FC<ReportCenterProps> = ({
  db,
  currentUser,
  initialStudentId,
  onSelectAssessmentStudent,
  setActiveTab,
}) => {
  const isTeacher = currentUser?.role === 'teacher';
  const teacherClass = currentUser?.assignedClass;
  const teacherSection = currentUser?.assignedSection;

  // View Mode: Cards vs Broadsheet Summary Ledger
  const [reportCenterTab, setReportCenterTab] = useState<'cards' | 'broadsheet'>('cards');

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

  // Form teacher for the selected broadsheet class and section
  const broadsheetFormTeacher = useMemo(() => {
    return getFormTeacherForClass(
      selectedClass,
      selectedSection !== 'ALL' ? selectedSection : undefined,
      db.classes,
      db.users
    );
  }, [selectedClass, selectedSection, db.classes, db.users]);

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId || 'ALL'
  );

  // Multi-Student Range & Selection
  const [selectionMode, setSelectionMode] = useState<'all' | 'single' | 'range'>('all');
  const [rangeInputString, setRangeInputString] = useState<string>('');
  const [customSelectedStudentIds, setCustomSelectedStudentIds] = useState<string[]>([]);

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

  // Canonical Class Check Helper: "Primary 1" matches "Primary One"
  const isClassEquivalent = (studentOrAsmClass: string, targetClass: string) => {
    if (!studentOrAsmClass || !targetClass) return false;
    if (studentOrAsmClass.toLowerCase().trim() === targetClass.toLowerCase().trim()) return true;
    const { className: canon1 } = matchCanonicalClass(studentOrAsmClass, db.classes);
    const { className: canon2 } = matchCanonicalClass(targetClass, db.classes);
    return canon1.toLowerCase().trim() === canon2.toLowerCase().trim();
  };

  // Get eligible students for the current single-class filter (including all arms when selectedSection is ALL)
  const singleClassStudents = useMemo(() => {
    return db.students.filter(s => {
      const isClassMatch = isClassEquivalent(s.className || '', selectedClass);
      const isActive = !s.status || s.status === 'Active';
      if (!isClassMatch || !isActive) return false;
      if (hasSections) {
        if (selectedSection && selectedSection !== 'ALL') {
          return (s.section || '').toUpperCase().trim() === selectedSection.toUpperCase().trim();
        }
        return true; // When 'ALL', include all students across arms
      }
      return true; // Classes without A and B have NO section
    });
  }, [db.students, selectedClass, selectedSection, hasSections, db.classes]);

  // Parse Range Input (e.g. "1-25", "1-10", "3, 5, 8") to Student IDs
  const parsedRangeStudentIds = useMemo(() => {
    if (selectionMode !== 'range') return [];
    if (!rangeInputString.trim()) {
      return customSelectedStudentIds;
    }
    const numbers = new Set<number>();
    const parts = rangeInputString.split(/[\s,]+/);
    parts.forEach(part => {
      const clean = part.trim();
      if (!clean) return;
      if (clean.includes('-')) {
        const [startStr, endStr] = clean.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.max(1, Math.min(start, end));
          const max = Math.min(singleClassStudents.length, Math.max(start, end));
          for (let i = min; i <= max; i++) numbers.add(i);
        }
      } else {
        const num = parseInt(clean, 10);
        if (!isNaN(num) && num >= 1 && num <= singleClassStudents.length) {
          numbers.add(num);
        }
      }
    });

    const idsFromNumbers = Array.from(numbers).map(n => singleClassStudents[n - 1]?.studentId).filter(Boolean);
    const combined = Array.from(new Set([...idsFromNumbers, ...customSelectedStudentIds]));
    return combined;
  }, [selectionMode, rangeInputString, customSelectedStudentIds, singleClassStudents]);

  // Collect reports to generate
  let reportsToGenerate: Array<{
    student: Student;
    assessment: AssessmentRecord;
    stats: any;
  }> = [];

  if (generationMode === 'single-class') {
    const isStudentIncluded = (s: Student) => {
      if (selectionMode === 'all') return true;
      if (selectionMode === 'single') return s.studentId === selectedStudentId;
      if (selectionMode === 'range') return parsedRangeStudentIds.includes(s.studentId);
      return true;
    };

    if (hasSections && selectedSection === 'ALL') {
      // Group by arm/section so students in Arm A and Arm B are each ranked accurately with their respective Form Masters!
      const arms = classSections.length > 0 ? classSections : [''];
      arms.forEach(armName => {
        const rawArmAssessments = db.assessments.filter(
          a =>
            isClassEquivalent(a.className, selectedClass) &&
            (!armName || (a.section || '').toUpperCase().trim() === armName.toUpperCase().trim()) &&
            a.academicSession === session &&
            a.term === term
        );
        const rankedArmAssessments = rankAssessments(rawArmAssessments);
        const armStats = computeClassStatistics(rankedArmAssessments);

        const targetStudents = singleClassStudents.filter(s => {
          if (armName && (s.section || '').toUpperCase().trim() !== armName.toUpperCase().trim()) return false;
          return isStudentIncluded(s);
        });

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
        if (!isClassEquivalent(a.className, selectedClass) || a.academicSession !== session || a.term !== term) return false;
        if (hasSections && selectedSection && selectedSection !== 'ALL') {
          return (a.section || '').toUpperCase().trim() === selectedSection.toUpperCase().trim();
        }
        return true;
      });
      const rankedClassAssessments = rankAssessments(rawClassAssessments);
      const classStats = computeClassStatistics(rankedClassAssessments);

      const targetStudents = singleClassStudents.filter(isStudentIncluded);

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

  // Performance bracket filter state ('all' | 'distinction' | 'credit' | 'support')
  const [performanceBracket, setPerformanceBracket] = useState<'all' | 'distinction' | 'credit' | 'support'>('all');
  const [showMissingStudentsList, setShowMissingStudentsList] = useState(false);

  // Identify enrolled students in this class who don't have assessment marks for this term
  const studentsMissingReports = useMemo(() => {
    if (generationMode !== 'single-class') return [];
    return singleClassStudents.filter(
      s => !reportsToGenerate.some(r => r.student.studentId === s.studentId)
    );
  }, [generationMode, singleClassStudents, reportsToGenerate]);

  // Performance-filtered reports
  const filteredReportsToGenerate = useMemo(() => {
    if (performanceBracket === 'distinction') {
      return reportsToGenerate.filter(r => r.assessment.finalAverage >= 75);
    }
    if (performanceBracket === 'credit') {
      return reportsToGenerate.filter(r => r.assessment.finalAverage >= 50 && r.assessment.finalAverage < 75);
    }
    if (performanceBracket === 'support') {
      return reportsToGenerate.filter(r => r.assessment.finalAverage < 50);
    }
    return reportsToGenerate;
  }, [reportsToGenerate, performanceBracket]);

  // Filter reports if single print or batch print is active
  const reportsToRender = useMemo(() => {
    if (printSingleStudentId) {
      return filteredReportsToGenerate.filter(item => item.student.studentId === printSingleStudentId);
    }
    if (printRange) {
      return filteredReportsToGenerate.slice(printRange.start, printRange.end);
    }
    return filteredReportsToGenerate;
  }, [filteredReportsToGenerate, printSingleStudentId, printRange]);

  // Compute batches of 50 for large student populations (hundreds)
  const printBatches = useMemo(() => {
    if (filteredReportsToGenerate.length <= 30) return [];
    const batches: Array<{ start: number; end: number; label: string }> = [];
    const batchSize = 50;
    for (let i = 0; i < filteredReportsToGenerate.length; i += batchSize) {
      const end = Math.min(i + batchSize, filteredReportsToGenerate.length);
      batches.push({
        start: i,
        end,
        label: `Reports ${i + 1} - ${end}`,
      });
    }
    return batches;
  }, [filteredReportsToGenerate.length]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900">Report Center &amp; Broadsheet</h2>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full">
              Single-Page A4 Ready
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Generate authentic A4 portrait Islamic school report sheets and terminal broadsheet summaries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportReportsToExcel}
            disabled={reportsToGenerate.length === 0}
            className="bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5 shadow cursor-pointer"
            title="Export all selected reports directly to Excel broadsheet"
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
            title="Print printer-friendly student report card(s)"
          >
            <Printer className="w-4 h-4" />
            <span>Print {reportsToGenerate.length > 1 ? `All Reports (${reportsToGenerate.length})` : 'Report Card'}</span>
          </button>
        </div>
      </div>

      {/* Main Mode Toggle: Report Cards vs Broadsheet Summary Ledger */}
      <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl w-fit no-print">
        <button
          type="button"
          onClick={() => setReportCenterTab('cards')}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition ${
            reportCenterTab === 'cards'
              ? 'bg-white text-blue-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4 text-blue-600" />
          <span>Student Report Cards ({reportsToGenerate.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setReportCenterTab('broadsheet')}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition ${
            reportCenterTab === 'broadsheet'
              ? 'bg-white text-purple-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TableProperties className="w-4 h-4 text-purple-600" />
          <span>Class Broadsheet Summary Ledger</span>
        </button>
      </div>

      {/* Filters Card */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4 no-print">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2 text-slate-800 font-semibold text-xs">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>Session &amp; Academic Scope:</span>
          </div>

          {!isTeacher ? (
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
              <button
                type="button"
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
                type="button"
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
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    <option value="ALL">All Arms / All Sections (Entire Class)</option>
                    {classSections.map(secName => {
                      const armCount = db.students.filter(
                        s => isClassEquivalent(s.className || '', selectedClass) && s.section === secName && (!s.status || s.status === 'Active')
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
                  Student Filter Mode
                </label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectionMode('all');
                      setSelectedStudentId('ALL');
                    }}
                    className={`py-1.5 rounded text-center transition ${
                      selectionMode === 'all'
                        ? 'bg-white text-blue-900 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({singleClassStudents.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectionMode('single');
                      if (selectedStudentId === 'ALL' && singleClassStudents[0]) {
                        setSelectedStudentId(singleClassStudents[0].studentId);
                      }
                    }}
                    className={`py-1.5 rounded text-center transition ${
                      selectionMode === 'single'
                        ? 'bg-white text-blue-900 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectionMode('range');
                      if (!rangeInputString) {
                        setRangeInputString(
                          singleClassStudents.length >= 25 ? '1-25' : `1-${singleClassStudents.length}`
                        );
                      }
                    }}
                    className={`py-1.5 rounded text-center transition ${
                      selectionMode === 'range'
                        ? 'bg-white text-blue-900 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Range / S/N
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-selector for Single Student */}
            {selectionMode === 'single' && (
              <div className="flex items-center space-x-2 pt-1">
                <select
                  value={selectedStudentId}
                  onChange={e => setSelectedStudentId(e.target.value)}
                  className="flex-1 text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
                >
                  {singleClassStudents.map((s, idx) => (
                    <option key={s.id} value={s.studentId}>
                      #{idx + 1}: {s.name} ({s.studentId} &bull; {s.admissionNumber})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handlePrintSingle(selectedStudentId)}
                  disabled={reportsToGenerate.length === 0}
                  className="px-3 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition flex items-center space-x-1 shadow-sm flex-shrink-0 cursor-pointer"
                  title="Print this student's report card"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Single</span>
                </button>
              </div>
            )}

            {/* Sub-selector for Range / Selection Numbers (e.g. 1-25) */}
            {selectionMode === 'range' && (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-blue-950">
                    <Hash className="w-4 h-4 text-blue-700" />
                    <span>Select Students by Numbers or Range (1 to {singleClassStudents.length}):</span>
                  </div>
                  {/* Presets */}
                  <div className="flex flex-wrap gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setRangeInputString(
                          singleClassStudents.length >= 10 ? '1-10' : `1-${singleClassStudents.length}`
                        )
                      }
                      className="px-2 py-0.5 bg-white border border-blue-200 text-blue-800 rounded font-semibold hover:bg-blue-100 cursor-pointer"
                    >
                      1-10
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRangeInputString(
                          singleClassStudents.length >= 25 ? '1-25' : `1-${singleClassStudents.length}`
                        )
                      }
                      className="px-2 py-0.5 bg-white border border-blue-200 text-blue-800 rounded font-semibold hover:bg-blue-100 cursor-pointer"
                    >
                      1-25
                    </button>
                    <button
                      type="button"
                      onClick={() => setRangeInputString(`1-${singleClassStudents.length}`)}
                      className="px-2 py-0.5 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 cursor-pointer"
                    >
                      All ({singleClassStudents.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRangeInputString('');
                        setCustomSelectedStudentIds([]);
                      }}
                      className="px-2 py-0.5 bg-white border border-slate-300 text-slate-600 rounded font-semibold hover:bg-slate-100 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={rangeInputString}
                  onChange={e => setRangeInputString(e.target.value)}
                  placeholder="e.g. 1-25 or 1-10, 15, 20-25"
                  className="w-full text-xs font-mono font-semibold bg-white border border-blue-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                />

                {/* S/N Toggle Chips */}
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 bg-white rounded-lg border border-blue-200">
                  {singleClassStudents.map((stu, i) => {
                    const num = i + 1;
                    const isSelected = parsedRangeStudentIds.includes(stu.studentId);
                    return (
                      <button
                        key={stu.id}
                        type="button"
                        onClick={() => {
                          setCustomSelectedStudentIds(prev =>
                            prev.includes(stu.studentId)
                              ? prev.filter(id => id !== stu.studentId)
                              : [...prev, stu.studentId]
                          );
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-700 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                        title={`#${num}: ${stu.name}`}
                      >
                        #{num} {stu.name.split(' ')[0]}
                      </button>
                    );
                  })}
                </div>

                <div className="text-[11px] text-blue-900 font-semibold flex items-center justify-between">
                  <span>Selected for Report Generation: {parsedRangeStudentIds.length} student(s)</span>
                  <span>(Filtered reports ready: {reportsToGenerate.length})</span>
                </div>
              </div>
            )}
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

        {/* Performance Bracket & Quick Filters */}
        {reportsToGenerate.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <div className="flex items-center space-x-1 text-xs">
              <span className="text-slate-500 font-semibold mr-1">Filter by Performance:</span>
              <button
                type="button"
                onClick={() => setPerformanceBracket('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                  performanceBracket === 'all'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Ready ({reportsToGenerate.length})
              </button>
              <button
                type="button"
                onClick={() => setPerformanceBracket('distinction')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                  performanceBracket === 'distinction'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                Distinction 75%+ ({reportsToGenerate.filter(r => r.assessment.finalAverage >= 75).length})
              </button>
              <button
                type="button"
                onClick={() => setPerformanceBracket('credit')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                  performanceBracket === 'credit'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
                }`}
              >
                Credit 50-74% ({reportsToGenerate.filter(r => r.assessment.finalAverage >= 50 && r.assessment.finalAverage < 75).length})
              </button>
              <button
                type="button"
                onClick={() => setPerformanceBracket('support')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                  performanceBracket === 'support'
                    ? 'bg-amber-700 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                Needs Support &lt;50% ({reportsToGenerate.filter(r => r.assessment.finalAverage < 50).length})
              </button>
            </div>
          </div>
        )}

        {/* Missing Marks Diagnostic Alert: explains why students might be missing */}
        {generationMode === 'single-class' && studentsMissingReports.length > 0 && (
          <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <span>
                  <strong className="text-amber-900">{studentsMissingReports.length} student(s)</strong> enrolled in {selectedClass} do not have assessment marks entered for {term} ({session}).
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowMissingStudentsList(prev => !prev)}
                  className="px-2.5 py-1 bg-white border border-amber-300 text-amber-900 rounded font-bold hover:bg-amber-100 transition flex items-center space-x-1"
                >
                  <span>{showMissingStudentsList ? 'Hide List' : `View Missing Students (${studentsMissingReports.length})`}</span>
                  {showMissingStudentsList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {onSelectAssessmentStudent && (
                  <button
                    type="button"
                    onClick={() => {
                      if (studentsMissingReports[0]) {
                        onSelectAssessmentStudent(
                          studentsMissingReports[0].studentId,
                          studentsMissingReports[0].className,
                          studentsMissingReports[0].section || ''
                        );
                      } else if (setActiveTab) {
                        setActiveTab('assessment');
                      }
                    }}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold transition shadow-xs flex items-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Grade Missing Students &rarr;</span>
                  </button>
                )}
              </div>
            </div>

            {/* Expandable list of students with missing marks */}
            {showMissingStudentsList && (
              <div className="pt-2 border-t border-amber-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {studentsMissingReports.map(stu => (
                  <div
                    key={stu.id}
                    className="p-2 bg-white rounded-lg border border-amber-200 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{stu.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {stu.studentId} &bull; {stu.admissionNumber}
                      </div>
                    </div>
                    {onSelectAssessmentStudent && (
                      <button
                        type="button"
                        onClick={() =>
                          onSelectAssessmentStudent(
                            stu.studentId,
                            stu.className,
                            stu.section || ''
                          )
                        }
                        className="text-[11px] font-bold text-blue-700 hover:underline bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                      >
                        Enter Marks
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected Summary Info */}
        <div className="p-3.5 rounded-lg bg-blue-50/80 border border-blue-200 text-xs text-blue-900 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold">Ready to generate:</span>{' '}
              <strong className="text-emerald-700 font-black text-sm">{filteredReportsToGenerate.length}</strong>{' '}
              student report sheet(s)
              {generationMode === 'single-class' && (
                <span className="text-slate-600 ml-1">
                  (out of {singleClassStudents.length} enrolled students in {selectedClass})
                </span>
              )}.
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
                Batch Print ({filteredReportsToGenerate.length} total pages):
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
                Print All ({filteredReportsToGenerate.length})
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

      {/* VIEW 1: CLASS BROADSHEET SUMMARY LEDGER */}
      {reportCenterTab === 'broadsheet' && reportsToGenerate.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4 print:p-0 print:border-none print:shadow-none">
          {/* Broadsheet Print Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
            <div>
              <div className="text-center sm:text-left">
                <span className="text-[11px] font-bold text-emerald-800 font-mono tracking-widest uppercase">
                  {db.settings.arabicSchoolName || db.settings.motto || 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'}
                </span>
                <h3 className="text-lg font-black text-slate-900 uppercase">
                  {db.settings.schoolName || 'School Broadsheet Summary'}
                </h3>
                <p className="text-xs font-semibold text-slate-600">
                  CLASS RESULT BROADSHEET &bull; {selectedClass} {selectedSection && selectedSection !== 'ALL' ? `(Arm ${selectedSection})` : '(All Arms)'} &bull; {term} ({session})
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 no-print self-end sm:self-auto">
              <button
                type="button"
                onClick={handleExportReportsToExcel}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Broadsheet (Excel)</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Broadsheet Ledger</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs no-print">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-slate-500 font-medium">Total Students Ranked</div>
              <div className="text-base font-bold text-slate-900">{reportsToGenerate.length}</div>
            </div>
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-blue-700 font-medium">Class Average</div>
              <div className="text-base font-bold text-blue-900">
                {reportsToGenerate.length > 0
                  ? (
                      reportsToGenerate.reduce((acc, r) => acc + (r.assessment.finalAverage || 0), 0) /
                      reportsToGenerate.length
                    ).toFixed(1) + '%'
                  : '0%'}
              </div>
            </div>
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="text-emerald-700 font-medium">Highest Average</div>
              <div className="text-base font-bold text-emerald-900">
                {reportsToGenerate.length > 0
                  ? Math.max(...reportsToGenerate.map(r => r.assessment.finalAverage || 0)).toFixed(1) + '%'
                  : '0%'}
              </div>
            </div>
            <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="text-purple-700 font-medium">Pass Rate (&ge;50%)</div>
              <div className="text-base font-bold text-purple-900">
                {reportsToGenerate.length > 0
                  ? Math.round(
                      (reportsToGenerate.filter(r => (r.assessment.finalAverage || 0) >= 50).length /
                        reportsToGenerate.length) *
                        100
                    ) + '%'
                  : '0%'}
              </div>
            </div>
          </div>

          {/* Broadsheet Scrollable Table */}
          <div className="overflow-x-auto border border-slate-300 rounded-lg">
            <table className="w-full text-xs text-left border-collapse font-sans">
              <thead>
                <tr className="bg-slate-800 text-white font-bold text-[11px] uppercase tracking-wider">
                  <th className="p-2 border border-slate-700 text-center w-10">S/N</th>
                  <th className="p-2 border border-slate-700 w-24">Adm No</th>
                  <th className="p-2 border border-slate-700 min-w-[150px]">Student Name</th>
                  <th className="p-2 border border-slate-700 text-center w-12">Arm</th>
                  <th className="p-2 border border-slate-700 text-center w-12">Sex</th>
                  {/* Distinct Subjects */}
                  {Array.from(
                    new Set(
                      reportsToGenerate.flatMap(r =>
                        (r.assessment.subjectScores || []).map(s => s.subjectName)
                      )
                    )
                  ).map(subName => (
                    <th key={subName} className="p-2 border border-slate-700 text-center min-w-[70px]" title={subName}>
                      {subName.length > 10 ? subName.slice(0, 9) + '…' : subName}
                    </th>
                  ))}
                  <th className="p-2 border border-slate-700 text-center w-16 bg-slate-900">Total</th>
                  <th className="p-2 border border-slate-700 text-center w-16 bg-slate-900">Avg %</th>
                  <th className="p-2 border border-slate-700 text-center w-14 bg-slate-900">Pos</th>
                  <th className="p-2 border border-slate-700 text-center min-w-[100px]">Remark</th>
                </tr>
              </thead>
              <tbody>
                {reportsToGenerate
                  .slice()
                  .sort((a, b) => (b.assessment.finalAverage || 0) - (a.assessment.finalAverage || 0))
                  .map((item, idx) => {
                    const subjects = Array.from(
                      new Set(
                        reportsToGenerate.flatMap(r =>
                          (r.assessment.subjectScores || []).map(s => s.subjectName)
                        )
                      )
                    );
                    const isEven = idx % 2 === 0;
                    return (
                      <tr
                        key={item.student.id}
                        className={`border-b border-slate-200 hover:bg-blue-50/50 transition ${
                          isEven ? 'bg-white' : 'bg-slate-50/60'
                        }`}
                      >
                        <td className="p-2 border border-slate-200 text-center font-bold text-slate-600 font-mono">
                          {idx + 1}
                        </td>
                        <td className="p-2 border border-slate-200 font-mono text-[11px] text-slate-600">
                          {item.student.admissionNumber || item.student.studentId}
                        </td>
                        <td className="p-2 border border-slate-200 font-bold text-slate-900">
                          {item.student.name}
                        </td>
                        <td className="p-2 border border-slate-200 text-center font-semibold text-slate-700">
                          {item.student.section || 'A'}
                        </td>
                        <td className="p-2 border border-slate-200 text-center font-semibold text-slate-600">
                          {item.student.gender === 'Female' ? 'F' : 'M'}
                        </td>
                        {subjects.map(subName => {
                          const scoreObj = item.assessment.subjectScores?.find(
                            s => s.subjectName.toLowerCase().trim() === subName.toLowerCase().trim()
                          );
                          return (
                            <td
                              key={subName}
                              className="p-1.5 border border-slate-200 text-center font-mono text-xs"
                            >
                              {scoreObj ? (
                                <span className={scoreObj.total < 50 ? 'text-red-600 font-bold' : 'text-slate-800'}>
                                  {scoreObj.total}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-2 border border-slate-200 text-center font-black text-slate-900 bg-slate-50/80 font-mono">
                          {item.assessment.totalScore || 0}
                        </td>
                        <td className="p-2 border border-slate-200 text-center font-black text-blue-900 bg-blue-50/40 font-mono">
                          {item.assessment.finalAverage ? item.assessment.finalAverage.toFixed(1) : '0'}%
                        </td>
                        <td className="p-2 border border-slate-200 text-center font-black text-emerald-800 bg-emerald-50/40 font-mono">
                          {item.assessment.finalPosition || `${idx + 1}`}
                        </td>
                        <td className="p-2 border border-slate-200 text-center text-[11px] font-semibold">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              (item.assessment.finalAverage || 0) >= 50
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {item.assessment.promotionRemark || ((item.assessment.finalAverage || 0) >= 50 ? 'PASSED' : 'FAIR')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Broadsheet Signatures footer for print */}
          <div className="grid grid-cols-3 gap-6 pt-8 mt-6 border-t border-slate-300 text-xs text-center">
            <div className="space-y-6">
              <div className="border-b border-slate-400 w-3/4 mx-auto"></div>
              <div className="font-bold text-slate-700">Form Teacher&apos;s Signature</div>
              {broadsheetFormTeacher && broadsheetFormTeacher !== 'Class Form Teacher' && (
                <div className="text-[11px] font-semibold text-slate-600 mt-1 uppercase tracking-wide">
                  ({broadsheetFormTeacher})
                </div>
              )}
            </div>
            <div className="space-y-6">
              <div className="border-b border-slate-400 w-3/4 mx-auto"></div>
              <div className="font-bold text-slate-700">Examination Officer</div>
            </div>
            <div className="space-y-6">
              <div className="border-b border-slate-400 w-3/4 mx-auto"></div>
              <div className="font-bold text-slate-700">Head Teacher / Principal &amp; Date</div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: INDIVIDUAL STUDENT REPORT CARDS (A4 PORTRAIT) */}
      {reportCenterTab === 'cards' && (
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
                    className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold px-3 py-1.5 rounded-md transition flex items-center space-x-1.5 shadow-sm active:scale-95 cursor-pointer"
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
                    className="text-slate-700 hover:text-slate-900 hover:bg-white text-xs font-semibold px-2.5 py-1.5 rounded-md border border-slate-300 transition flex items-center space-x-1 cursor-pointer"
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
      )}

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
