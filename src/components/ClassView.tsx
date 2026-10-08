import React, { useState, useEffect, useMemo } from 'react';
import { AppDatabase, NavigationTab, UserAccount, Student } from '../types';
import { getSectionsForClass, formatClassWithSection } from '../utils/classSections';
import {
  Users,
  CheckCircle,
  Clock,
  ClipboardPenLine,
  FileText,
  Filter,
  Lock,
  LayoutGrid,
  TableProperties,
  Search,
  Phone,
  User,
  CheckSquare,
  Square,
  ArrowRight,
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  GraduationCap,
} from 'lucide-react';

interface ClassViewProps {
  db: AppDatabase;
  currentUser?: UserAccount;
  setActiveTab: (tab: NavigationTab) => void;
  onSelectAssessmentStudent: (studentId: string, className: string, section: string) => void;
  onSelectReportStudent: (studentId: string) => void;
  onSaveStudent?: (student: Student) => void;
  onSelectStudentProfile?: (studentId: string) => void;
}

export const ClassView: React.FC<ClassViewProps> = ({
  db,
  currentUser,
  setActiveTab,
  onSelectAssessmentStudent,
  onSelectReportStudent,
  onSaveStudent,
  onSelectStudentProfile,
}) => {
  const isTeacher = currentUser?.role === 'teacher';
  const teacherClass = currentUser?.assignedClass;
  const teacherSection = currentUser?.assignedSection;

  // Filters
  const [selectedSession, setSelectedSession] = useState<string>(
    currentUser?.assignedSession || db.settings.currentSession || db.sessions[0] || '2026/2027'
  );
  const [selectedTerm, setSelectedTerm] = useState<string>(
    db.settings.currentTerm || db.terms[0] || '1st Term'
  );
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
      ? (isTeacher && teacherSection ? teacherSection : (classSections[0] || 'A'))
      : ''
  );

  // Synchronize section if current selection is not valid for this class
  useEffect(() => {
    if (hasSections) {
      if (!classSections.includes(selectedSection)) {
        setSelectedSection(classSections[0] || 'A');
      }
    } else {
      setSelectedSection('');
    }
  }, [selectedClass, classSections, selectedSection, hasSections]);

  // View Mode: Card View (for student profiles) vs Table View (for quick bulk grading or status updates)
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive' | 'PendingMarks' | 'EnteredMarks'>('all');

  // Bulk actions in Table View
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  // Profile inspect modal
  const [inspectedStudent, setInspectedStudent] = useState<Student | null>(null);

  // Filter students for this class and section
  const classStudents = useMemo(() => {
    return db.students.filter(s => {
      const isClassMatch = s.className.toLowerCase().trim() === selectedClass.toLowerCase().trim();
      if (!isClassMatch) return false;
      if (hasSections) {
        return s.section === selectedSection;
      }
      return true; // Classes without A and B have NO section
    });
  }, [db.students, selectedClass, selectedSection, hasSections]);

  // Search & Status filtered students
  const filteredStudents = useMemo(() => {
    return classStudents.filter(student => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = student.name.toLowerCase().includes(q);
        const matchesId = student.studentId.toLowerCase().includes(q);
        const matchesAdm = student.admissionNumber?.toLowerCase().includes(q);
        const matchesParent = student.parentName?.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesAdm && !matchesParent) return false;
      }

      // Status
      if (statusFilter === 'Active' && student.status !== 'Active') return false;
      if (statusFilter === 'Inactive' && student.status === 'Active') return false;

      // Assessment marks
      if (statusFilter === 'PendingMarks' || statusFilter === 'EnteredMarks') {
        const assessment = db.assessments.find(
          a =>
            a.studentId === student.studentId &&
            a.academicSession === selectedSession &&
            a.term === selectedTerm
        );
        if (statusFilter === 'PendingMarks' && assessment) return false;
        if (statusFilter === 'EnteredMarks' && !assessment) return false;
      }

      return true;
    });
  }, [classStudents, searchQuery, statusFilter, db.assessments, selectedSession, selectedTerm]);

  const boys = classStudents.filter(s => s.gender === 'Male').length;
  const girls = classStudents.filter(s => s.gender === 'Female').length;

  const gradedAssessments = useMemo(() => {
    return db.assessments.filter(
      a =>
        a.academicSession === selectedSession &&
        a.term === selectedTerm &&
        classStudents.some(s => s.studentId === a.studentId)
    );
  }, [db.assessments, selectedSession, selectedTerm, classStudents]);

  const gradedCount = gradedAssessments.length;
  const pendingCount = Math.max(0, classStudents.length - gradedCount);

  // Bulk selection handlers
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map(s => s.id));
    }
  };

  const handleToggleSelectStudent = (studentId: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  // Bulk status update
  const handleBulkStatusChange = (newStatus: 'Active' | 'Inactive') => {
    if (!onSaveStudent || selectedStudentIds.length === 0) return;
    const targetStudents = db.students.filter(s => selectedStudentIds.includes(s.id));
    targetStudents.forEach(st => {
      onSaveStudent({
        ...st,
        status: newStatus,
      });
    });
    setNotification(`Successfully updated ${targetStudents.length} student(s) to ${newStatus}`);
    setSelectedStudentIds([]);
    setTimeout(() => setNotification(null), 3500);
  };

  // Toggle individual student status
  const handleToggleStudentStatus = (student: Student) => {
    if (!onSaveStudent) return;
    const nextStatus = student.status === 'Active' ? 'Inactive' : 'Active';
    onSaveStudent({
      ...student,
      status: nextStatus,
    });
    setNotification(`${student.name} status updated to ${nextStatus}`);
    setTimeout(() => setNotification(null), 3000);
  };

  // Quick next pending student grading
  const handleGradeNextPending = () => {
    const nextPending = classStudents.find(
      s =>
        !db.assessments.some(
          a =>
            a.studentId === s.studentId &&
            a.academicSession === selectedSession &&
            a.term === selectedTerm
        )
    );
    if (nextPending) {
      onSelectAssessmentStudent(
        nextPending.studentId,
        nextPending.className,
        hasSections ? (nextPending.section || selectedSection) : ''
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Class Roster &amp; Academic Management</h2>
          <p className="text-xs text-slate-500">
            Switch between Card View for student profiles and Table View for quick bulk grading and status updates.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {pendingCount > 0 && (
            <button
              onClick={handleGradeNextPending}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
              title="Quickly jump to first student with pending marks"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Grade Next Pending ({pendingCount})</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('assessment')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
          >
            <ClipboardPenLine className="w-3.5 h-3.5" />
            <span>Enter Assessment</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Class Reports</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Selector */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center space-x-2 text-slate-700 text-sm font-semibold">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span>Select Class &amp; Academic Term:</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Academic Session
            </label>
            <select
              value={selectedSession}
              onChange={e => setSelectedSession(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white"
            >
              {db.sessions.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Academic Term
            </label>
            <select
              value={selectedTerm}
              onChange={e => setSelectedTerm(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white"
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
              {isTeacher ? 'Assigned Class (Locked)' : 'Class'}
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
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white text-slate-900"
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
              {isTeacher && teacherSection ? 'Section / Arm (Locked)' : 'Section / Arm'}
            </label>
            {!hasSections ? (
              <div className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2 bg-slate-100 text-slate-500 italic flex items-center justify-between">
                <span>No Section (Single Stream)</span>
              </div>
            ) : isTeacher && teacherSection ? (
              <div className="w-full text-xs font-bold border border-amber-300 rounded-lg p-2 bg-amber-50 text-amber-900 flex items-center justify-between">
                <span>Section {selectedSection}</span>
                <Lock className="w-3.5 h-3.5 text-amber-600" />
              </div>
            ) : (
              <select
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white text-slate-900"
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

        {/* Mini stats bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center space-x-3 sm:space-x-4 flex-wrap gap-1">
            <span className="font-bold text-slate-900">
              {selectedClass} {hasSections ? `\u2022 Section ${selectedSection}` : '\u2022 Single Stream (No Section)'}
            </span>
            <span>
              Total: <strong className="text-slate-900">{classStudents.length}</strong> students
            </span>
            <span>
              (<strong className="text-blue-700">{boys}</strong> Boys,{' '}
              <strong className="text-pink-600">{girls}</strong> Girls)
            </span>
            <span className="inline-flex items-center space-x-1 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
              <span className="text-emerald-700 font-bold">{gradedCount} Graded</span>
              <span className="text-slate-400">/</span>
              <span className="text-amber-700 font-bold">{pendingCount} Pending</span>
            </span>
          </div>

          <button
            onClick={() => setActiveTab('class-summary')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
          >
            View Complete Broadsheet Summary &rarr;
          </button>
        </div>
      </div>

      {/* Roster Controls: Toggle View Mode & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        {/* Toggle between Card View and Table View */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
                viewMode === 'card'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Card View: Visual student profiles, photos, parent details, and academic cards"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Card View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
                viewMode === 'table'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Table View: Compact roster for quick bulk grading, status updates, and summary"
            >
              <TableProperties className="w-3.5 h-3.5" />
              <span>Table View</span>
            </button>
          </div>

          <span className="text-xs text-slate-500 font-medium hidden md:inline">
            {viewMode === 'card' ? 'Student Profiles Mode' : 'Bulk Grading & Roster Mode'}
          </span>
        </div>

        {/* Search & Quick Filters */}
        <div className="flex items-center space-x-2 flex-1 sm:max-w-md justify-end">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, ID, parent..."
              className="w-full text-xs pl-8 pr-7 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="text-xs border border-slate-300 rounded-lg p-1.5 bg-slate-50 focus:bg-white text-slate-700 font-medium"
          >
            <option value="all">All Students ({classStudents.length})</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
            <option value="PendingMarks">Pending Grading ({pendingCount})</option>
            <option value="EnteredMarks">Marks Entered ({gradedCount})</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Bar (When rows selected in Table View) */}
      {viewMode === 'table' && selectedStudentIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center space-x-2 font-bold text-blue-950">
            <CheckSquare className="w-4 h-4 text-blue-700" />
            <span>{selectedStudentIds.length} student(s) selected:</span>
          </div>
          <div className="flex items-center space-x-2">
            {onSaveStudent && (
              <>
                <button
                  onClick={() => handleBulkStatusChange('Active')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg transition shadow-xs"
                >
                  Set to Active
                </button>
                <button
                  onClick={() => handleBulkStatusChange('Inactive')}
                  className="bg-slate-700 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded-lg transition shadow-xs"
                >
                  Set to Inactive
                </button>
              </>
            )}
            <button
              onClick={() => setSelectedStudentIds([])}
              className="text-slate-600 hover:text-slate-900 underline px-2 py-1 font-semibold"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* No Students Message */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 shadow-sm">
          <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
          <p className="font-semibold text-slate-700">
            {classStudents.length === 0
              ? `No active students found in ${selectedClass} ${hasSections ? `– Section ${selectedSection}` : ''}.`
              : 'No students match the selected search or grading status filter.'}
          </p>
          {classStudents.length === 0 ? (
            <button
              onClick={() => setActiveTab('students')}
              className="mt-2 text-xs text-blue-700 hover:underline font-semibold"
            >
              Add or reassign students to this class in Student Management
            </button>
          ) : (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="mt-2 text-xs text-blue-700 hover:underline font-semibold"
            >
              Clear filters and view all students
            </button>
          )}
        </div>
      ) : viewMode === 'card' ? (
        /* =========================================================
           CARD VIEW (For Student Profiles)
           ========================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map(student => {
            const assessment = db.assessments.find(
              a =>
                a.studentId === student.studentId &&
                a.academicSession === selectedSession &&
                a.term === selectedTerm
            );

            const isMale = student.gender === 'Male';
            const initials = student.name
              .split(' ')
              .map(n => n[0])
              .filter(Boolean)
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <div
                key={student.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all duration-150 flex flex-col justify-between overflow-hidden"
              >
                {/* Card Top: Avatar, Name, Admission, Status */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-xs ${
                          isMale ? 'bg-blue-600' : 'bg-pink-600'
                        }`}
                      >
                        {initials}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm leading-tight line-clamp-1">
                          {student.name}
                        </h4>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono mt-0.5">
                          <span className="font-bold text-slate-700">{student.admissionNumber || student.studentId}</span>
                          <span>&bull;</span>
                          <span className={isMale ? 'text-blue-700 font-medium' : 'text-pink-600 font-medium'}>
                            {student.gender}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Pill with interactive click if onSaveStudent is available */}
                    {onSaveStudent ? (
                      <button
                        onClick={() => handleToggleStudentStatus(student)}
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full transition border ${
                          student.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                        }`}
                        title="Click to toggle Active / Inactive status"
                      >
                        {student.status || 'Active'}
                      </button>
                    ) : (
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          student.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}
                      >
                        {student.status || 'Active'}
                      </span>
                    )}
                  </div>

                  {/* Profile Metadata */}
                  <div className="bg-slate-50/80 rounded-lg p-2.5 text-xs text-slate-600 space-y-1 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Enrolled Class:</span>
                      <span className="font-semibold text-slate-900 truncate">
                        {formatClassWithSection(student.className, student.section, db.classes)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Parent / Guardian:</span>
                      <span className="font-medium text-slate-800 truncate">
                        {student.parentName || 'None listed'}
                      </span>
                    </div>

                    {student.parentPhone && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Contact Phone:</span>
                        <a
                          href={`tel:${student.parentPhone}`}
                          className="font-mono text-blue-700 hover:underline flex items-center space-x-1"
                        >
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{student.parentPhone}</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Academic Assessment Performance Capsule */}
                  <div className="pt-1">
                    {assessment ? (
                      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-2.5 flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-1.5 text-emerald-900 text-xs font-bold">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span>Marks Entered ({selectedTerm})</span>
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5 flex items-center space-x-2">
                            <span>Score: <strong className="text-slate-900">{assessment.totalScore}</strong></span>
                            <span>&bull;</span>
                            <span>Avg: <strong className="text-slate-900">{assessment.finalAverage}%</strong></span>
                          </div>
                        </div>

                        {assessment.finalPosition && (
                          <div className="bg-emerald-600 text-white text-xs font-black px-2 py-1 rounded shadow-2xs">
                            {assessment.finalPosition}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-1.5 text-amber-900 font-medium">
                          <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                          <span>Pending grading for {selectedTerm}</span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          Not Graded
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="bg-slate-50 border-t border-slate-100 px-3 py-2.5 flex items-center justify-between gap-1 text-xs">
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() =>
                        onSelectAssessmentStudent(
                          student.studentId,
                          student.className,
                          hasSections ? (student.section || selectedSection) : ''
                        )
                      }
                      className="bg-blue-700 hover:bg-blue-800 text-white font-bold px-2.5 py-1.5 rounded-lg transition flex items-center space-x-1 shadow-2xs"
                      title={assessment ? 'Edit student assessment marks' : 'Enter student assessment marks'}
                    >
                      <ClipboardPenLine className="w-3 h-3" />
                      <span>{assessment ? 'Edit Marks' : 'Enter Marks'}</span>
                    </button>

                    {assessment && (
                      <button
                        type="button"
                        onClick={() => onSelectReportStudent(student.studentId)}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold px-2 py-1.5 rounded-lg border border-emerald-200 transition flex items-center space-x-1"
                        title="View printable Islamic report card"
                      >
                        <FileText className="w-3 h-3 text-emerald-600" />
                        <span>Report</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectStudentProfile) {
                        onSelectStudentProfile(student.id || student.studentId);
                      } else {
                        setInspectedStudent(student);
                      }
                    }}
                    className="text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 p-1.5 rounded-md transition flex items-center space-x-1 font-medium"
                    title="View full student profile"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>Profile</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* =========================================================
           TABLE VIEW (For Quick Bulk Grading or Status Updates)
           ========================================================= */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-slate-500 hover:text-slate-800"
                      title="Select all students"
                    >
                      {selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-blue-700" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-3 w-10">#</th>
                  <th className="py-3 px-4">Student ID / Adm No</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-3">Gender</th>
                  <th className="py-3 px-4">Parent &amp; Phone</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Assessment Marks</th>
                  <th className="py-3 px-4 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student, idx) => {
                  const assessment = db.assessments.find(
                    a =>
                      a.studentId === student.studentId &&
                      a.academicSession === selectedSession &&
                      a.term === selectedTerm
                  );

                  const isSelected = selectedStudentIds.includes(student.id);

                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectStudent(student.id)}
                          className="text-slate-500 hover:text-slate-800"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-700" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-3 text-slate-400 font-mono text-xs">{idx + 1}</td>

                      <td className="py-3 px-4 font-mono text-xs">
                        <div className="font-bold text-slate-900">{student.studentId}</div>
                        <div className="text-slate-400 text-[10px]">{student.admissionNumber}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                          <span>{student.name}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`text-[11px] font-semibold ${
                            student.gender === 'Male' ? 'text-blue-700' : 'text-pink-600'
                          }`}
                        >
                          {student.gender}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs">
                        <div className="text-slate-800 truncate max-w-[150px]">{student.parentName || '-'}</div>
                        {student.parentPhone && (
                          <a
                            href={`tel:${student.parentPhone}`}
                            className="text-slate-500 font-mono text-[11px] hover:text-blue-700 hover:underline"
                          >
                            {student.parentPhone}
                          </a>
                        )}
                      </td>

                      {/* Quick Status Update Selector */}
                      <td className="py-3 px-3 text-center">
                        {onSaveStudent ? (
                          <select
                            value={student.status || 'Active'}
                            onChange={e => {
                              onSaveStudent({
                                ...student,
                                status: e.target.value as any,
                              });
                              setNotification(`${student.name} status updated to ${e.target.value}`);
                              setTimeout(() => setNotification(null), 3000);
                            }}
                            className={`text-xs font-bold rounded-lg px-2 py-1 border transition ${
                              student.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="Graduated">Graduated</option>
                            <option value="Withdrawn">Withdrawn</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              student.status === 'Active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {student.status || 'Active'}
                          </span>
                        )}
                      </td>

                      {/* Assessment Status & Marks */}
                      <td className="py-3 px-4 text-center font-mono">
                        {assessment ? (
                          <div className="inline-block bg-slate-50 border border-slate-200 px-2 py-1 rounded">
                            <span className="font-bold text-slate-900">{assessment.totalScore}</span>
                            <span className="text-slate-500 text-xs"> ({assessment.finalAverage}%)</span>
                            {assessment.finalPosition && (
                              <span className="ml-1 text-[11px] font-bold text-emerald-700">
                                [{assessment.finalPosition}]
                              </span>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              onSelectAssessmentStudent(
                                student.studentId,
                                student.className,
                                hasSections ? (student.section || selectedSection) : ''
                              )
                            }
                            className="inline-flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition"
                            title="Click to enter marks for this student"
                          >
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending &bull; Enter Marks</span>
                          </button>
                        )}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            onSelectAssessmentStudent(
                              student.studentId,
                              student.className,
                              hasSections ? (student.section || selectedSection) : ''
                            )
                          }
                          className="bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs px-2.5 py-1 rounded-lg border border-blue-200 transition inline-flex items-center space-x-1"
                          title={assessment ? 'Edit marks' : 'Enter marks'}
                        >
                          <ClipboardPenLine className="w-3 h-3" />
                          <span>{assessment ? 'Edit' : 'Grade'}</span>
                        </button>

                        {assessment && (
                          <button
                            type="button"
                            onClick={() => onSelectReportStudent(student.studentId)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs px-2.5 py-1 rounded-lg border border-emerald-200 transition"
                            title="View student report card"
                          >
                            Report
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectStudentProfile) {
                              onSelectStudentProfile(student.id || student.studentId);
                            } else {
                              setInspectedStudent(student);
                            }
                          }}
                          className="text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 p-1 rounded-md transition"
                          title="View student profile"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INSPECT STUDENT PROFILE MODAL */}
      {inspectedStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base text-white shadow-xs ${
                    inspectedStudent.gender === 'Male' ? 'bg-blue-600' : 'bg-pink-600'
                  }`}
                >
                  {inspectedStudent.name
                    .split(' ')
                    .map(n => n[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{inspectedStudent.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    ID: {inspectedStudent.studentId} &bull; Adm: {inspectedStudent.admissionNumber}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setInspectedStudent(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Class Stream</span>
                <span className="font-bold text-slate-900">
                  {formatClassWithSection(inspectedStudent.className, inspectedStudent.section, db.classes)}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Gender</span>
                <span className="font-bold text-slate-900">{inspectedStudent.gender}</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Parent / Guardian</span>
                <span className="font-bold text-slate-900">{inspectedStudent.parentName || 'None'}</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Contact Phone</span>
                <span className="font-bold text-slate-900">{inspectedStudent.parentPhone || 'None'}</span>
              </div>

              {inspectedStudent.dateOfBirth && (
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Date of Birth</span>
                  <span className="font-bold text-slate-900">{inspectedStudent.dateOfBirth}</span>
                </div>
              )}

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                <span className="font-bold text-emerald-700">{inspectedStudent.status || 'Active'}</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const st = inspectedStudent;
                  setInspectedStudent(null);
                  onSelectAssessmentStudent(
                    st.studentId,
                    st.className,
                    hasSections ? (st.section || selectedSection) : ''
                  );
                }}
                className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-3.5 py-2 rounded-lg transition"
              >
                Enter / Edit Marks
              </button>
              <button
                type="button"
                onClick={() => {
                  const st = inspectedStudent;
                  setInspectedStudent(null);
                  onSelectReportStudent(st.studentId);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg transition"
              >
                View Report Sheet
              </button>
              <button
                type="button"
                onClick={() => setInspectedStudent(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

