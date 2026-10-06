import React, { useState } from 'react';
import { AppDatabase, NavigationTab } from '../types';
import { computeClassStatistics, calculateGrade } from '../utils/ranking';
import { exportAssessmentBroadsheetToExcel } from '../utils/excel';
import {
  TableProperties,
  Printer,
  FileSpreadsheet,
  Filter,
  Eye,
  X,
  Building2,
} from 'lucide-react';

interface ClassSummaryProps {
  db: AppDatabase;
  setActiveTab: (tab: NavigationTab) => void;
  onSelectReportStudent: (studentId: string) => void;
}

export const ClassSummary: React.FC<ClassSummaryProps> = ({
  db,
  setActiveTab,
  onSelectReportStudent,
}) => {
  const [selectedSession, setSelectedSession] = useState<string>(db.settings.currentSession);
  const [selectedTerm, setSelectedTerm] = useState<string>(db.settings.currentTerm);
  const [selectedClass, setSelectedClass] = useState<string>(
    db.classes[0]?.name || 'Nursery One'
  );
  const [selectedSection, setSelectedSection] = useState<string>(
    db.sections[0]?.name || 'A'
  );

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Filter assessments for this class and section
  const classAssessments = db.assessments
    .filter(
      a =>
        a.className === selectedClass &&
        a.section === selectedSection &&
        a.academicSession === selectedSession &&
        a.term === selectedTerm
    )
    .sort((a, b) => {
      // Sort by final average descending
      return b.finalAverage - a.finalAverage;
    });

  const studentMap = db.students.reduce<Record<string, any>>((acc, s) => {
    acc[s.studentId] = s;
    return acc;
  }, {});

  // Compute statistics
  const stats = computeClassStatistics(classAssessments);

  // Excel export
  const handleExportExcel = () => {
    exportAssessmentBroadsheetToExcel(
      classAssessments,
      studentMap,
      selectedClass,
      selectedSection,
      selectedSession,
      selectedTerm
    );
  };

  // Browser Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Class Performance Broadsheet &amp; Master Summary
          </h2>
          <p className="text-xs text-slate-500">
            Official summary of all student assessment scores, rank positions, and attendance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center space-x-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview Broadsheet</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export to Excel</span>
          </button>
          <button
            onClick={handlePrint}
            className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Summary</span>
          </button>
        </div>
      </div>

      {/* Class Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm no-print">
        <div className="flex items-center space-x-2 text-slate-700 text-sm font-semibold mb-3">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span>Select Class:</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Academic Session
            </label>
            <select
              value={selectedSession}
              onChange={e => setSelectedSession(e.target.value)}
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
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Term
            </label>
            <select
              value={selectedTerm}
              onChange={e => setSelectedTerm(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 bg-slate-50"
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
              Class
            </label>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-slate-50 text-slate-900"
            >
              {db.classes.map(c => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Section
            </label>
            <select
              value={selectedSection}
              onChange={e => setSelectedSection(e.target.value)}
              className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-slate-50 text-slate-900"
            >
              {db.sections.map(s => (
                <option key={s.id} value={s.name}>
                  Section {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Stats Box */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 no-print">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase">Assessed Students</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.studentCount}</p>
          <span className="text-xs text-slate-400">In this class &amp; arm</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase">Highest Average</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {stats.highestAverage > 0 ? `${stats.highestAverage}%` : '-'}
          </p>
          <span className="text-xs text-slate-400">Class top mark</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase">Lowest Average</span>
          <p className="text-2xl font-black text-amber-600 mt-1">
            {stats.lowestAverage > 0 ? `${stats.lowestAverage}%` : '-'}
          </p>
          <span className="text-xs text-slate-400">Class minimum mark</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase">Class Average</span>
          <p className="text-2xl font-black text-blue-700 mt-1">
            {stats.classAverage > 0 ? `${stats.classAverage}%` : '-'}
          </p>
          <span className="text-xs text-slate-400">Class mean score</span>
        </div>
      </div>

      {/* Summary Table (Screen & Print layout) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
        {/* Printable Header */}
        <div className="p-4 border-b border-slate-200 print:border-b-2 print:border-black text-center">
          <h2 className="font-amiri text-xl font-bold text-slate-900 leading-snug">
            {db.settings.arabicSchoolName}
          </h2>
          <h1 className="text-base font-black uppercase text-slate-900">
            {db.settings.schoolName}
          </h1>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700 mt-0.5">
            CLASS ASSESSMENT BROADSHEET &bull; {selectedClass} ({selectedSection}) &bull;{' '}
            {selectedTerm} &bull; {selectedSession}
          </p>
          <div className="flex items-center justify-center space-x-6 text-xs text-slate-600 mt-1 print:text-black">
            <span>
              Total Students: <strong>{stats.studentCount}</strong>
            </span>
            <span>
              Highest: <strong>{stats.highestAverage}%</strong>
            </span>
            <span>
              Lowest: <strong>{stats.lowestAverage}%</strong>
            </span>
            <span>
              Class Average: <strong>{stats.classAverage}%</strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-800 font-bold uppercase text-[11px] border-b border-slate-200 print:bg-gray-100 print:text-black">
              <tr>
                <th className="py-2.5 px-3 text-center w-16">Position</th>
                <th className="py-2.5 px-3">Student ID</th>
                <th className="py-2.5 px-3">Student Full Name</th>
                <th className="py-2.5 px-3 text-center">Total Score</th>
                <th className="py-2.5 px-3 text-center">Final Avg (%)</th>
                <th className="py-2.5 px-3 text-center">Grade</th>
                <th className="py-2.5 px-3 text-center">Present</th>
                <th className="py-2.5 px-3 text-center">Absent</th>
                <th className="py-2.5 px-3">Remark</th>
                <th className="py-2.5 px-3 text-right no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-slate-300">
              {classAssessments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <TableProperties className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">
                      No assessment records found for {selectedClass} &ndash; Section {selectedSection} ({selectedTerm}).
                    </p>
                    <button
                      onClick={() => setActiveTab('assessment')}
                      className="mt-2 text-xs text-emerald-700 hover:underline font-semibold no-print"
                    >
                      Enter student assessment marks now &rarr;
                    </button>
                  </td>
                </tr>
              ) : (
                classAssessments.map(record => {
                  const student = studentMap[record.studentId];
                  const { grade } = calculateGrade(record.finalAverage, db.gradingBoundaries);

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50 transition print:hover:bg-transparent"
                    >
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900 bg-slate-50/70 print:bg-transparent">
                        <span className="inline-block px-2 py-0.5 rounded font-black text-xs bg-slate-200 text-slate-900 print:bg-transparent print:border print:border-black">
                          {record.finalPosition || '-'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-mono font-medium text-slate-600">
                        {record.studentId}
                      </td>

                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {student ? student.name : record.studentId}
                      </td>

                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                        {record.totalScore}
                      </td>

                      <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700">
                        {record.finalAverage}%
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <span className="font-black px-2 py-0.5 rounded bg-slate-900 text-white text-[11px] print:text-black print:bg-transparent print:border">
                          {grade}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center font-medium text-slate-700">
                        {record.daysPresent}
                      </td>

                      <td className="py-2.5 px-3 text-center font-medium text-slate-700">
                        {record.daysAbsent}
                      </td>

                      <td className="py-2.5 px-3 text-xs italic text-slate-600">
                        {record.promotionRemark || record.formTeacherComment || '-'}
                      </td>

                      <td className="py-2.5 px-3 text-right space-x-1 no-print">
                        <button
                          onClick={() => onSelectReportStudent(record.studentId)}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-1 rounded transition"
                        >
                          Report
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Broadsheet Footer */}
        <div className="p-4 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Generated by Islamic School Student Assessment &amp; Report System &bull;{' '}
            {db.settings.schoolName}
          </span>
          <span className="font-bold text-slate-700">
            M-SAGEER DIGITAL TECHNOLOGIES LTD &bull; 07066979027
          </span>
        </div>
      </div>

      {/* MODAL PREVIEW */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 relative">
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-blue-800" />
                <h3 className="text-base font-bold text-slate-900">
                  Class Broadsheet Preview &bull; {selectedClass} ({selectedSection})
                </h3>
              </div>
              <div className="flex items-center space-x-2 mr-6">
                <button
                  onClick={handlePrint}
                  className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-3 py-1.5 rounded transition flex items-center space-x-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Broadsheet</span>
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto border border-slate-200 p-4 rounded-lg bg-slate-50 text-xs">
              <div className="text-center mb-4">
                <h2 className="font-amiri text-2xl font-bold">{db.settings.arabicSchoolName}</h2>
                <h1 className="text-lg font-black uppercase">{db.settings.schoolName}</h1>
                <p className="text-xs text-slate-600 font-semibold">{db.settings.motto}</p>
                <p className="text-xs text-slate-700 font-bold mt-1">
                  OFFICIAL CLASS SUMMARY &bull; {selectedClass} &bull; SECTION {selectedSection} &bull;{' '}
                  {selectedTerm} ({selectedSession})
                </p>
              </div>

              <table className="w-full text-left bg-white border border-slate-300">
                <thead className="bg-slate-100 font-bold border-b border-slate-300">
                  <tr>
                    <th className="p-2 text-center">Pos</th>
                    <th className="p-2">Name</th>
                    <th className="p-2 text-center">Score</th>
                    <th className="p-2 text-center">Average</th>
                    <th className="p-2 text-center">Grade</th>
                    <th className="p-2">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {classAssessments.map(rec => (
                    <tr key={rec.id}>
                      <td className="p-2 text-center font-bold">{rec.finalPosition || '-'}</td>
                      <td className="p-2 font-semibold">
                        {studentMap[rec.studentId]?.name || rec.studentId}
                      </td>
                      <td className="p-2 text-center font-mono">{rec.totalScore}</td>
                      <td className="p-2 text-center font-mono font-bold text-emerald-700">
                        {rec.finalAverage}%
                      </td>
                      <td className="p-2 text-center font-bold">
                        {calculateGrade(rec.finalAverage, db.gradingBoundaries).grade}
                      </td>
                      <td className="p-2 text-slate-600">
                        {rec.promotionRemark || rec.formTeacherComment}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-4 mt-2">
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
