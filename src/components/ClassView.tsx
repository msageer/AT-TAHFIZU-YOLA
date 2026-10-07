import React, { useState, useEffect, useMemo } from 'react';
import { AppDatabase, NavigationTab, UserAccount } from '../types';
import { getSectionsForClass } from '../utils/classSections';
import {
  Users,
  CheckCircle,
  Clock,
  ClipboardPenLine,
  FileText,
  Filter,
  Lock,
} from 'lucide-react';

interface ClassViewProps {
  db: AppDatabase;
  currentUser?: UserAccount;
  setActiveTab: (tab: NavigationTab) => void;
  onSelectAssessmentStudent: (studentId: string, className: string, section: string) => void;
  onSelectReportStudent: (studentId: string) => void;
}

export const ClassView: React.FC<ClassViewProps> = ({
  db,
  currentUser,
  setActiveTab,
  onSelectAssessmentStudent,
  onSelectReportStudent,
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
    isTeacher && teacherClass ? teacherClass : (db.classes[0]?.name || 'Nursery One')
  );
  const [selectedSection, setSelectedSection] = useState<string>(
    isTeacher && teacherSection ? teacherSection : (db.sections[0]?.name || 'A')
  );

  // Applicable arms/sections for selected class (not all classes have A and B)
  const classSections = useMemo(() => {
    return getSectionsForClass(selectedClass, db.classes, db.sections);
  }, [selectedClass, db.classes, db.sections]);

  // Synchronize section if current selection is not valid for this class
  useEffect(() => {
    if (classSections.length > 0 && !classSections.includes(selectedSection)) {
      setSelectedSection(classSections[0]);
    }
  }, [selectedClass, classSections, selectedSection]);

  // Filter students for this class and section
  const classStudents = db.students.filter(
    s => s.className === selectedClass && s.section === selectedSection && s.status === 'Active'
  );

  const boys = classStudents.filter(s => s.gender === 'Male').length;
  const girls = classStudents.filter(s => s.gender === 'Female').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Class Roster &amp; Academic Status</h2>
          <p className="text-xs text-slate-500">
            View student lists by class and section, tracking assessment and report status.
          </p>
        </div>

        <div className="flex items-center space-x-2">
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

      {/* Filter Selector */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-2 text-slate-700 text-sm font-semibold mb-3">
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
                  if (!validSecs.includes(selectedSection)) {
                    setSelectedSection(validSecs[0] || 'A');
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
            {isTeacher && teacherSection ? (
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
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600">
          <div className="flex items-center space-x-4">
            <span className="font-bold text-slate-900">
              {selectedClass} &bull; Section {selectedSection}
            </span>
            <span>
              Total: <strong className="text-slate-900">{classStudents.length}</strong> students
            </span>
            <span>
              (<strong className="text-blue-700">{boys}</strong> Boys,{' '}
              <strong className="text-pink-600">{girls}</strong> Girls)
            </span>
          </div>

          <button
            onClick={() => setActiveTab('class-summary')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline"
          >
            View Complete Broadsheet Summary &rarr;
          </button>
        </div>
      </div>

      {/* Class Students Roster Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Student ID / Adm No</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Gender</th>
                <th className="py-3 px-4">Parent &amp; Phone</th>
                <th className="py-3 px-4 text-center">Assessment Status</th>
                <th className="py-3 px-4 text-center">Score / Average</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">
                      No active students found in {selectedClass} &ndash; Section {selectedSection}.
                    </p>
                    <button
                      onClick={() => setActiveTab('students')}
                      className="mt-2 text-xs text-blue-700 hover:underline font-semibold"
                    >
                      Add or reassign students to this class
                    </button>
                  </td>
                </tr>
              ) : (
                classStudents.map((student, idx) => {
                  const assessment = db.assessments.find(
                    a =>
                      a.studentId === student.studentId &&
                      a.academicSession === selectedSession &&
                      a.term === selectedTerm
                  );

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>

                      <td className="py-3 px-4 font-mono text-xs">
                        <div className="font-bold text-slate-900">{student.studentId}</div>
                        <div className="text-slate-400 text-[10px]">{student.admissionNumber}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{student.name}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-[11px] font-semibold ${
                            student.gender === 'Male' ? 'text-blue-700' : 'text-pink-600'
                          }`}
                        >
                          {student.gender}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs">
                        <div className="text-slate-800">{student.parentName || '-'}</div>
                        <div className="text-slate-500 font-mono text-[11px]">
                          {student.parentPhone || ''}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {assessment ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>Entered</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center font-mono">
                        {assessment ? (
                          <div>
                            <span className="font-bold text-slate-900">
                              {assessment.totalScore}
                            </span>
                            <span className="text-slate-500 text-xs">
                              {' '}
                              ({assessment.finalAverage}%)
                            </span>
                            <span className="ml-1 text-[11px] font-bold text-emerald-700">
                              [{assessment.finalPosition || '-'}]
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() =>
                            onSelectAssessmentStudent(
                              student.studentId,
                              student.className,
                              student.section
                            )
                          }
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs px-2.5 py-1 rounded transition"
                        >
                          {assessment ? 'Edit Marks' : 'Enter Marks'}
                        </button>
                        {assessment && (
                          <button
                            onClick={() => onSelectReportStudent(student.studentId)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs px-2.5 py-1 rounded transition"
                          >
                            Report
                          </button>
                        )}
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
