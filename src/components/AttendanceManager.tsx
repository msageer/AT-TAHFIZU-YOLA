import React, { useState, useEffect } from 'react';
import { AppDatabase, AttendanceRecord, Student, UserAccount } from '../types';
import { exportAttendanceToExcel } from '../utils/excel';
import {
  CalendarCheck,
  Save,
  CheckCircle,
  FileSpreadsheet,
  Users,
  Filter,
  Lock,
} from 'lucide-react';

interface AttendanceManagerProps {
  db: AppDatabase;
  currentUser?: UserAccount;
  onSaveAttendanceBatch: (records: AttendanceRecord[]) => void;
}

export const AttendanceManager: React.FC<AttendanceManagerProps> = ({
  db,
  currentUser,
  onSaveAttendanceBatch,
}) => {
  const isTeacher = currentUser?.role === 'teacher';
  const teacherClass = currentUser?.assignedClass;
  const teacherSection = currentUser?.assignedSection;

  const [session, setSession] = useState<string>(
    currentUser?.assignedSession || db.settings.currentSession || db.sessions[0] || '2026/2027'
  );
  const [term, setTerm] = useState<string>(
    db.settings.currentTerm || db.terms[0] || '1st Term'
  );
  const [selectedClass, setSelectedClass] = useState<string>(
    isTeacher && teacherClass ? teacherClass : (db.classes[0]?.name || 'Nursery One')
  );
  const [selectedSection, setSelectedSection] = useState<string>(
    isTeacher && teacherSection ? teacherSection : (db.sections[0]?.name || 'A')
  );

  // Global default days opened for fast batch application
  const [defaultDaysOpened, setDefaultDaysOpened] = useState<number>(90);
  const [notification, setNotification] = useState<string | null>(null);

  // Filter students for this class and arm
  const classStudents = db.students.filter(
    s => s.className === selectedClass && s.section === selectedSection && s.status === 'Active'
  );

  // Local editing attendance records
  const [attendanceRows, setAttendanceRows] = useState<
    Array<{
      studentId: string;
      name: string;
      daysOpened: number;
      daysPresent: number;
      daysAbsent: number;
      remark: string;
    }>
  >([]);

  // Synchronize when class/session/term changes
  useEffect(() => {
    const existing = db.attendance || [];
    const rows = classStudents.map(student => {
      const match = existing.find(
        a =>
          a.studentId === student.studentId &&
          a.academicSession === session &&
          a.term === term
      );

      // Or fallback to assessment attendance if entered
      const assessmentMatch = db.assessments.find(
        a =>
          a.studentId === student.studentId &&
          a.academicSession === session &&
          a.term === term
      );

      const opened = match?.daysOpened ?? assessmentMatch?.daysOpened ?? defaultDaysOpened;
      const present = match?.daysPresent ?? assessmentMatch?.daysPresent ?? (opened - 2 > 0 ? opened - 2 : opened);
      const absent = Math.max(0, opened - present);

      return {
        studentId: student.studentId,
        name: student.name,
        daysOpened: opened,
        daysPresent: present,
        daysAbsent: absent,
        remark: match?.remark || (absent <= 3 ? 'Regular' : 'Needs improvement'),
      };
    });

    setAttendanceRows(rows);
  }, [selectedClass, selectedSection, session, term, db.attendance, db.assessments, db.students]);

  // Handle changing days present
  const handleDaysChange = (index: number, field: 'daysOpened' | 'daysPresent', val: number) => {
    setAttendanceRows(prev => {
      const updated = [...prev];
      const cur = { ...updated[index], [field]: Math.max(0, val) };
      if (cur.daysPresent > cur.daysOpened) {
        cur.daysPresent = cur.daysOpened;
      }
      cur.daysAbsent = Math.max(0, cur.daysOpened - cur.daysPresent);
      updated[index] = cur;
      return updated;
    });
  };

  // Apply default days opened to all students in this class
  const handleApplyDefaultOpened = () => {
    setAttendanceRows(prev =>
      prev.map(row => {
        const opened = Math.max(0, defaultDaysOpened);
        const present = Math.min(opened, row.daysPresent);
        return {
          ...row,
          daysOpened: opened,
          daysPresent: present,
          daysAbsent: Math.max(0, opened - present),
        };
      })
    );
  };

  // Save attendance batch
  const handleSaveAll = () => {
    const recordsToSave: AttendanceRecord[] = attendanceRows.map(row => ({
      id: `att-${row.studentId}-${session.replace('/', '-')}-${term.replace(/\s+/g, '-')}`,
      studentId: row.studentId,
      academicSession: session,
      term,
      className: selectedClass,
      section: selectedSection,
      daysOpened: row.daysOpened,
      daysPresent: row.daysPresent,
      daysAbsent: row.daysAbsent,
      remark: row.remark,
      updatedAt: new Date().toISOString(),
    }));

    onSaveAttendanceBatch(recordsToSave);
    setNotification('Attendance records saved and linked with report sheets!');
    setTimeout(() => setNotification(null), 3500);
  };

  // Export to Excel
  const handleExport = () => {
    const studentMap = db.students.reduce<Record<string, Student>>((acc, s) => {
      acc[s.studentId] = s;
      return acc;
    }, {});

    const fullRecords = attendanceRows.map(r => ({
      id: `att-${r.studentId}`,
      studentId: r.studentId,
      academicSession: session,
      term,
      className: selectedClass,
      section: selectedSection,
      daysOpened: r.daysOpened,
      daysPresent: r.daysPresent,
      daysAbsent: r.daysAbsent,
      remark: r.remark,
      updatedAt: new Date().toISOString(),
    }));

    exportAttendanceToExcel(fullRecords, studentMap, session, term, selectedClass);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Term Attendance Management</h2>
          <p className="text-xs text-slate-500">
            Record days school opened, days present, and absence metrics. Auto-synced with student reports.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExport}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export to Excel</span>
          </button>
          <button
            onClick={handleSaveAll}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
          >
            <Save className="w-4 h-4" />
            <span>Save Attendance</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Filter and Class Selector */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 text-slate-700 text-xs font-semibold">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span>Select Attendance Target:</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Session
            </label>
            <select
              value={session}
              onChange={e => setSession(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded p-2 bg-slate-50"
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
              className="w-full text-xs font-medium border border-slate-300 rounded p-2 bg-slate-50"
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
                <span>{selectedClass}</span>
                <Lock className="w-3.5 h-3.5 text-amber-600" />
              </div>
            ) : (
              <select
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                className="w-full text-xs font-semibold border border-slate-300 rounded p-2 bg-slate-50 text-slate-900"
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
                <span>Section {selectedSection}</span>
                <Lock className="w-3.5 h-3.5 text-amber-600" />
              </div>
            ) : (
              <select
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
                className="w-full text-xs font-semibold border border-slate-300 rounded p-2 bg-slate-50 text-slate-900"
              >
                {db.sections.map(s => (
                  <option key={s.id} value={s.name}>
                    Section {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Batch Set Days School Opened */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-700">Days School Opened this Term:</span>
            <input
              type="number"
              min="1"
              value={defaultDaysOpened}
              onChange={e => setDefaultDaysOpened(Number(e.target.value) || 0)}
              className="w-20 text-center font-bold border border-slate-300 rounded p-1.5"
            />
            <button
              type="button"
              onClick={handleApplyDefaultOpened}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-2.5 py-1.5 rounded transition"
            >
              Apply to All Students
            </button>
          </div>

          <div className="text-slate-500">
            Total Students in Class: <strong>{classStudents.length}</strong>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12">#</th>
                <th className="py-3 px-4">Student ID</th>
                <th className="py-3 px-4">Student Full Name</th>
                <th className="py-3 px-4 text-center w-28">Days Opened</th>
                <th className="py-3 px-4 text-center w-28">Days Present</th>
                <th className="py-3 px-4 text-center w-28">Days Absent</th>
                <th className="py-3 px-4 text-center w-28">Attendance %</th>
                <th className="py-3 px-4">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attendanceRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">
                      No active students found in {selectedClass} &ndash; Section {selectedSection}.
                    </p>
                  </td>
                </tr>
              ) : (
                attendanceRows.map((row, idx) => {
                  const rate =
                    row.daysOpened > 0
                      ? Math.round((row.daysPresent / row.daysOpened) * 100)
                      : 0;

                  return (
                    <tr key={row.studentId} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>

                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        {row.studentId}
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900">{row.name}</td>

                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={row.daysOpened}
                          onChange={e =>
                            handleDaysChange(idx, 'daysOpened', Number(e.target.value) || 0)
                          }
                          className="w-16 text-center font-bold border border-slate-300 rounded p-1"
                        />
                      </td>

                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          max={row.daysOpened}
                          value={row.daysPresent}
                          onChange={e =>
                            handleDaysChange(idx, 'daysPresent', Number(e.target.value) || 0)
                          }
                          className="w-16 text-center font-bold border border-emerald-400 text-emerald-950 bg-emerald-50/50 rounded p-1"
                        />
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                        {row.daysAbsent}
                      </td>

                      <td className="py-3 px-4 text-center font-mono">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                            rate >= 90
                              ? 'bg-emerald-100 text-emerald-800'
                              : rate >= 75
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {rate}%
                        </span>
                      </td>

                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={row.remark}
                          onChange={e => {
                            const val = e.target.value;
                            setAttendanceRows(prev => {
                              const updated = [...prev];
                              updated[idx] = { ...updated[idx], remark: val };
                              return updated;
                            });
                          }}
                          className="w-full text-xs border border-slate-300 rounded p-1"
                          placeholder="e.g. Regular"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
