import React, { useState } from 'react';
import { AppDatabase, Student, StudentHistoryEntry } from '../types';
import { getSectionsForClass } from '../utils/classSections';
import { ConfirmModal } from './ConfirmModal';
import {
  GraduationCap,
  ArrowRight,
  CheckCircle,
  Users,
  CheckSquare,
  Square,
  History,
  AlertCircle,
} from 'lucide-react';

interface StudentPromotionProps {
  db: AppDatabase;
  onPromoteStudents: (
    studentIds: string[],
    toClass: string,
    toSection: string,
    historyEntries: Record<string, StudentHistoryEntry>
  ) => void;
}

export const StudentPromotion: React.FC<StudentPromotionProps> = ({
  db,
  onPromoteStudents,
}) => {
  const [fromClass, setFromClass] = useState<string>(
    db.classes[0]?.name || 'Nursery One'
  );
  const [fromSection, setFromSection] = useState<string>('ALL');

  const [toClass, setToClass] = useState<string>(
    db.classes[1]?.name || db.classes[0]?.name || 'Nursery Two'
  );
  const [toSection, setToSection] = useState<string>(
    db.sections[0]?.name || 'A'
  );

  const [fromSession, setFromSession] = useState<string>(db.settings.currentSession);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  } | null>(null);

  // Eligible students in 'From Class'
  const eligibleStudents = db.students.filter(s => {
    if (s.className !== fromClass) return false;
    if (fromSection !== 'ALL' && s.section !== fromSection) return false;
    return s.status === 'Active';
  });

  // Toggle selection
  const handleToggleStudent = (id: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedStudentIds.length === eligibleStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(eligibleStudents.map(s => s.id));
    }
  };

  const executePromotion = () => {
    const historyEntries: Record<string, StudentHistoryEntry> = {};

    selectedStudentIds.forEach(id => {
      const student = db.students.find(s => s.id === id);
      if (!student) return;

      // Find student's last assessment in this class
      const lastAssessment = db.assessments
        .filter(a => a.studentId === student.studentId && a.academicSession === fromSession)
        .slice(-1)[0];

      historyEntries[id] = {
        session: fromSession,
        term: lastAssessment?.term || db.settings.currentTerm,
        className: student.className,
        section: student.section,
        totalScore: lastAssessment?.totalScore,
        finalAverage: lastAssessment?.finalAverage,
        position: lastAssessment?.finalPosition,
        date: new Date().toISOString().split('T')[0],
        remark: `Promoted from ${student.className} to ${toClass}`,
      };
    });

    onPromoteStudents(selectedStudentIds, toClass, toSection, historyEntries);
    setSuccessMessage(
      `Successfully promoted ${selectedStudentIds.length} student(s) to ${toClass} (Section ${toSection})! Their past academic records have been safely archived in their profiles.`
    );
    setSelectedStudentIds([]);
    setConfirmModalConfig(null);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // Perform promotion with confirmation pop-up
  const handlePromote = () => {
    if (selectedStudentIds.length === 0) {
      return;
    }

    const isSameClass = fromClass === toClass;
    setConfirmModalConfig({
      isOpen: true,
      title: isSameClass ? 'Confirm Re-Enrollment / Repeat' : 'Confirm Student Promotion',
      message: isSameClass
        ? `Both source and destination are "${fromClass}". Are you sure you want to re-enroll/repeat ${selectedStudentIds.length} students in this class?`
        : `Are you sure you want to promote ${selectedStudentIds.length} student(s) from "${fromClass}" to "${toClass}" (${toSection})?`,
      details: `Count: ${selectedStudentIds.length} students • Target: ${toClass} (${toSection})`,
      variant: isSameClass ? 'warning' : 'primary',
      confirmText: isSameClass ? 'Yes, Re-enroll' : 'Yes, Promote Students',
      onConfirm: () => {
        executePromotion();
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Student Promotion &amp; Session Rollover
        </h2>
        <p className="text-xs text-slate-500">
          Move students to their next class at the end of an academic session. Historical marks, positions, and report cards remain permanently preserved.
        </p>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Promotion Config Box */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
          {/* FROM CLASS */}
          <div className="md:col-span-2 p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              1. Current Class (Promote From)
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase">Class</label>
                <select
                  value={fromClass}
                  onChange={e => {
                    const newFrom = e.target.value;
                    setFromClass(newFrom);
                    setSelectedStudentIds([]);
                    const validFromSecs = getSectionsForClass(newFrom, db.classes, db.sections);
                    if (fromSection !== 'ALL' && !validFromSecs.includes(fromSection)) {
                      setFromSection('ALL');
                    }
                  }}
                  className="w-full text-xs font-bold border border-slate-300 rounded p-2 bg-white"
                >
                  {db.classes.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase">Section</label>
                <select
                  value={fromSection}
                  onChange={e => {
                    setFromSection(e.target.value);
                    setSelectedStudentIds([]);
                  }}
                  className="w-full text-xs font-semibold border border-slate-300 rounded p-2 bg-white"
                >
                  <option value="ALL">All Sections</option>
                  {getSectionsForClass(fromClass, db.classes, db.sections).map(secName => (
                    <option key={secName} value={secName}>
                      Section {secName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ARROW */}
          <div className="flex justify-center text-blue-700">
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>

          {/* TO CLASS */}
          <div className="md:col-span-2 p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-3">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block">
              2. Target Class (Promote Into)
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase">Target Class</label>
                <select
                  value={toClass}
                  onChange={e => {
                    const newTo = e.target.value;
                    setToClass(newTo);
                    const validToSecs = getSectionsForClass(newTo, db.classes, db.sections);
                    if (!validToSecs.includes(toSection)) {
                      setToSection(validToSecs[0] || 'A');
                    }
                  }}
                  className="w-full text-xs font-bold border border-emerald-300 rounded p-2 bg-white text-emerald-950"
                >
                  {db.classes.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase">Target Section</label>
                <select
                  value={toSection}
                  onChange={e => setToSection(e.target.value)}
                  className="w-full text-xs font-semibold border border-emerald-300 rounded p-2 bg-white text-emerald-950"
                >
                  {getSectionsForClass(toClass, db.classes, db.sections).map(secName => (
                    <option key={secName} value={secName}>
                      Section {secName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Action ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-blue-700 hover:underline font-semibold"
            >
              {selectedStudentIds.length === eligibleStudents.length && eligibleStudents.length > 0
                ? 'Deselect All'
                : 'Select All Eligible Students'}
            </button>
            <span className="text-slate-400">&bull;</span>
            <span className="text-slate-600 font-medium">
              Selected: <strong>{selectedStudentIds.length}</strong> of{' '}
              <strong>{eligibleStudents.length}</strong> students
            </span>
          </div>

          <button
            type="button"
            onClick={handlePromote}
            disabled={selectedStudentIds.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold px-5 py-2.5 rounded-lg transition shadow flex items-center justify-center space-x-1.5"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Promote Selected Students &rarr;</span>
          </button>
        </div>
      </div>

      {/* Eligible Students List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Students in {fromClass} ({eligibleStudents.length})
          </span>
          <span className="text-xs text-slate-500">
            Check the students who passed and are moving to {toClass}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Select</th>
                <th className="py-3 px-4">Student ID / Adm No</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Current Arm</th>
                <th className="py-3 px-4">Gender</th>
                <th className="py-3 px-4 text-center">Last Assessment</th>
                <th className="py-3 px-4">Promotion Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {eligibleStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">
                      No active students found in {fromClass}.
                    </p>
                  </td>
                </tr>
              ) : (
                eligibleStudents.map(student => {
                  const isChecked = selectedStudentIds.includes(student.id);
                  const lastAssessment = db.assessments
                    .filter(a => a.studentId === student.studentId)
                    .slice(-1)[0];

                  return (
                    <tr
                      key={student.id}
                      onClick={() => handleToggleStudent(student.id)}
                      className={`cursor-pointer transition ${
                        isChecked ? 'bg-emerald-50/70 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 mx-auto" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 mx-auto" />
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-xs">
                        <div className="font-bold text-slate-900">{student.studentId}</div>
                        <div className="text-slate-400 text-[10px]">{student.admissionNumber}</div>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900">{student.name}</td>

                      <td className="py-3 px-4 text-slate-700">Section {student.section}</td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-xs ${
                            student.gender === 'Male' ? 'text-blue-700 font-bold' : 'text-pink-600 font-bold'
                          }`}
                        >
                          {student.gender}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-mono">
                        {lastAssessment ? (
                          <span className="text-xs">
                            <strong className="text-slate-900">{lastAssessment.finalAverage}%</strong>{' '}
                            <span className="text-emerald-700 font-bold">
                              [{lastAssessment.finalPosition || '-'}]
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">No marks</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            lastAssessment?.promotionRemark === 'PASS & REPEAT'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {lastAssessment?.promotionRemark || 'PASS & PROMOTED'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
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
