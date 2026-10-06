import React, { useState } from 'react';
import {
  Users,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  FileText,
  UserPlus,
  ArrowRight,
  Filter,
  CheckCircle,
  AlertTriangle,
  CalendarCheck,
  ArrowUpRight,
  Sparkles,
  Upload,
} from 'lucide-react';
import { AppDatabase, NavigationTab, UserAccount } from '../types';

interface DashboardProps {
  db: AppDatabase;
  currentUser?: UserAccount;
  setActiveTab: (tab: NavigationTab) => void;
  onSelectAssessmentStudent?: (studentId: string, className: string, section: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  db,
  currentUser,
  setActiveTab,
  onSelectAssessmentStudent,
}) => {
  const isTeacher = currentUser?.role === 'teacher';
  const teacherClass = currentUser?.assignedClass;
  const teacherSection = currentUser?.assignedSection;

  const [selectedSession, setSelectedSession] = useState<string>(
    currentUser?.assignedSession || db.settings.currentSession || db.sessions[0] || '2026/2027'
  );
  const [selectedTerm, setSelectedTerm] = useState<string>(
    db.settings.currentTerm || db.terms[0] || '1st Term'
  );
  const [selectedClass, setSelectedClass] = useState<string>(
    isTeacher && teacherClass ? teacherClass : 'ALL'
  );

  // Filtered counts
  const filteredStudents = db.students.filter(s => {
    if (isTeacher && teacherClass && s.className !== teacherClass) return false;
    if (isTeacher && teacherSection && s.section !== teacherSection) return false;
    if (!isTeacher && selectedClass !== 'ALL' && s.className !== selectedClass) return false;
    return s.status === 'Active';
  });

  const totalStudents = filteredStudents.length;
  const maleCount = filteredStudents.filter(s => s.gender === 'Male').length;
  const femaleCount = filteredStudents.filter(s => s.gender === 'Female').length;

  const currentTermAssessments = db.assessments.filter(
    a => a.academicSession === selectedSession && a.term === selectedTerm
  );

  // Incomplete assessments count
  const assessedStudentIds = new Set(currentTermAssessments.map(a => a.studentId));
  const pendingAssessmentsCount = filteredStudents.filter(
    s => !assessedStudentIds.has(s.studentId)
  ).length;

  // Attendance issues count (students absent > 5 days)
  const attendanceIssues = (db.attendance || []).filter(
    a => a.academicSession === selectedSession && a.term === selectedTerm && a.daysAbsent > 5
  ).length;

  return (
    <div className="space-y-6">
      {/* Standard School Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-xl p-6 text-white shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-emerald-700 text-emerald-100 font-amiri">
                {db.settings.arabicSchoolName || 'التحفيظ والإتقان'}
              </span>
              <span className="text-xs text-slate-300">
                {selectedSession} &bull; {selectedTerm}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {db.settings.schoolName || 'Islamic School Management System'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              {db.settings.motto || 'شعارنا: خيركم من تعلم القرآن وعلمه'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isTeacher && (
              <button
                onClick={() => setActiveTab('import-export')}
                className="bg-blue-800 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
              >
                <Upload className="w-4 h-4" />
                <span>Import Spreadsheet</span>
              </button>
            )}
            {isTeacher && (
              <button
                onClick={() => setActiveTab('students')}
                className="bg-blue-800 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
              >
                <Users className="w-4 h-4" />
                <span>My Class Students</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('assessment')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>Enter Marks</span>
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className="bg-purple-700 hover:bg-purple-600 text-white text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
            >
              <FileText className="w-4 h-4" />
              <span>Reports</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notice if zero students enrolled */}
      {db.students.length === 0 && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>
              <strong>Student Directory Empty:</strong> Upload your student list spreadsheet (.xlsx / .csv) or click <strong>Students</strong> to enroll students.
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('import-export')}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg transition shadow-sm text-xs"
            >
              Upload Spreadsheet
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className="px-3 py-1.5 bg-white border border-blue-300 hover:bg-blue-50 text-blue-800 font-semibold rounded-lg transition text-xs"
            >
              Add Student
            </button>
          </div>
        </div>
      )}

      {/* Global Filter Bar */}
      <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2 text-slate-700 text-sm font-semibold">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span>Dashboard Scope Filter:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase">Session</label>
            <select
              value={selectedSession}
              onChange={e => setSelectedSession(e.target.value)}
              className="mt-0.5 text-xs font-medium border border-slate-300 rounded px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {db.sessions.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase">Term</label>
            <select
              value={selectedTerm}
              onChange={e => setSelectedTerm(e.target.value)}
              className="mt-0.5 text-xs font-medium border border-slate-300 rounded px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {db.terms.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase">
              {isTeacher ? 'Assigned Class (Locked)' : 'Class Filter'}
            </label>
            {isTeacher ? (
              <div className="mt-0.5 text-xs font-bold border border-amber-300 bg-amber-50 text-amber-900 rounded px-2.5 py-1.5">
                {teacherClass || 'Assigned Class'} {teacherSection ? `(Arm ${teacherSection})` : ''}
              </div>
            ) : (
              <select
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                className="mt-0.5 text-xs font-medium border border-slate-300 rounded px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">All Classes ({db.classes.length})</option>
                {db.classes.map(c => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Students</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalStudents}</p>
          <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-1">
            <span className="text-blue-700 font-semibold">{maleCount} Boys</span> &bull;{' '}
            <span className="text-pink-600 font-semibold">{femaleCount} Girls</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Classes</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{db.classes.length}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {db.sections.length} Arms / Sections
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Subjects</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {db.subjects.filter(s => s.isActive).length}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Islamic &amp; General</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Pending Marks</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-700">{pendingAssessmentsCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {currentTermAssessments.length} marks completed
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Attendance Track</span>
            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-teal-700">
            {attendanceIssues > 0 ? `${attendanceIssues} Alert` : 'Optimal'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {attendanceIssues > 0 ? 'Students absent > 5 days' : 'Regular school attendance'}
          </p>
        </div>
      </div>

      {/* Class Assessment Status Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Class Performance &amp; Assessment Roster</h3>
            <p className="text-xs text-slate-500">
              Overview of active classes for {selectedSession} &bull; {selectedTerm}
            </p>
          </div>
          <button
            onClick={() => setActiveTab('classes')}
            className="text-xs font-semibold text-blue-700 hover:text-blue-800 flex items-center space-x-1"
          >
            <span>View All Class Rosters</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Total Students</th>
                <th className="py-3 px-4">Boys / Girls</th>
                <th className="py-3 px-4">Assessments Done</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.classes.map(cls => {
                const classStudents = db.students.filter(
                  s => s.className === cls.name && s.status === 'Active'
                );
                const boys = classStudents.filter(s => s.gender === 'Male').length;
                const girls = classStudents.filter(s => s.gender === 'Female').length;

                const assessedCount = currentTermAssessments.filter(
                  a => a.className === cls.name
                ).length;

                const isComplete =
                  classStudents.length > 0 && assessedCount >= classStudents.length;
                const isPartial = assessedCount > 0 && assessedCount < classStudents.length;

                return (
                  <tr key={cls.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {cls.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <span className="font-bold">{classStudents.length}</span> students
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs">
                      <span className="text-blue-700 font-semibold">{boys} M</span> /{' '}
                      <span className="text-pink-600 font-semibold">{girls} F</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{assessedCount}</span>
                        <span className="text-slate-400">/ {classStudents.length}</span>
                        {classStudents.length > 0 && (
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-600 h-1.5 rounded-full"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.round((assessedCount / classStudents.length) * 100)
                                )}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {classStudents.length === 0 ? (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                          No students
                        </span>
                      ) : isComplete ? (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold flex items-center w-fit space-x-1">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span>Complete</span>
                        </span>
                      ) : isPartial ? (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                          In Progress
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          if (classStudents.length > 0 && onSelectAssessmentStudent) {
                            onSelectAssessmentStudent(classStudents[0].studentId, cls.name, classStudents[0].section);
                          } else {
                            setActiveTab('assessment');
                          }
                        }}
                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-2.5 py-1 rounded transition"
                      >
                        Enter Marks
                      </button>
                      <button
                        onClick={() => setActiveTab('reports')}
                        className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-1 rounded transition"
                      >
                        Reports
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveTab('students')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-500 cursor-pointer transition flex items-center space-x-3.5 group"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Manage Students</h4>
            <p className="text-xs text-slate-500">Student directory &amp; profiles</p>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('attendance')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-teal-500 cursor-pointer transition flex items-center space-x-3.5 group"
        >
          <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Track Attendance</h4>
            <p className="text-xs text-slate-500">Record days opened &amp; presence</p>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('promotion')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-500 cursor-pointer transition flex items-center space-x-3.5 group"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Student Promotion</h4>
            <p className="text-xs text-slate-500">Promote to next class &amp; archive</p>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('import-export')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-amber-500 cursor-pointer transition flex items-center space-x-3.5 group"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Spreadsheet Center</h4>
            <p className="text-xs text-slate-500">Bulk upload or export Excel</p>
          </div>
        </div>
      </div>
    </div>
  );
};
