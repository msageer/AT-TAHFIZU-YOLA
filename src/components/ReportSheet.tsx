import React from 'react';
import { SchoolSettings, Student, AssessmentRecord, GradeBoundary, PsychomotorItem } from '../types';
import { ClassStatistics } from '../utils/ranking';

interface ReportSheetProps {
  settings: SchoolSettings;
  student: Student;
  assessment: AssessmentRecord;
  stats: ClassStatistics;
  gradingBoundaries: GradeBoundary[];
  psychomotorItems: PsychomotorItem[];
}

export const ReportSheet: React.FC<ReportSheetProps> = ({
  settings,
  student,
  assessment,
  stats,
  gradingBoundaries,
  psychomotorItems,
}) => {
  const subjectScores = assessment.subjectScores || [];

  return (
    <div className="report-sheet-root relative bg-white text-black p-5 mx-auto font-sans leading-tight border-2 border-slate-900 rounded-none shadow-sm max-w-[210mm] min-h-[290mm] box-border print:border-2 print:border-black print:p-4 print:shadow-none print:max-w-none print:w-full print:min-h-0 page-break">
      {/* Background Watermark */}
      {settings.logoUrl && (
        <div
          className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.04] overflow-hidden"
          style={{ zIndex: 0 }}
        >
          <img
            src={settings.logoUrl}
            alt="School Watermark"
            className="w-[380px] h-[380px] object-contain grayscale"
          />
        </div>
      )}

      <div className="relative z-10 flex flex-col justify-between h-full">
        {/* Top Header with Double Border Frame */}
        <div className="border-2 border-slate-900 p-2 text-center mb-2">
          <div className="flex items-center justify-between gap-2">
            {/* Logo */}
            <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt="School Logo"
                  className="max-h-20 max-w-20 object-contain"
                />
              ) : (
                <div className="w-16 h-16 border border-dashed border-gray-400 flex items-center justify-center text-xs text-gray-400">
                  Logo
                </div>
              )}
            </div>

            {/* School Text */}
            <div className="flex-1 px-1">
              <h2 className="font-amiri text-2xl font-bold tracking-wide text-slate-950 mb-0.5 leading-snug">
                {settings.arabicSchoolName || 'التحفيظ والإتقان الإسلامية، يولا'}
              </h2>
              <h1 className="text-lg md:text-xl font-black uppercase tracking-tight text-slate-950 leading-tight">
                {settings.schoolName || 'AT-TAHFIZU WAL ITQAN ISLAMIYYA, YOLA'}
              </h1>
              <p className="text-xs font-semibold text-slate-800 mt-0.5 italic">
                {settings.motto || 'Motto: خيركم من تعلم القرآن وعلمه'}
              </p>
              <p className="text-[11px] text-slate-800 mt-0.5 font-medium leading-snug">
                <span className="font-bold">ADDRESS:</span> {settings.address}
              </p>
              <p className="text-[11px] text-slate-800 font-medium">
                <span className="font-bold">Tel. No:</span> {settings.telephone}
                {settings.email ? ` | ${settings.email}` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Report Sheet Title */}
        <div className="text-center my-1.5 border-b-2 border-dashed border-slate-800 pb-1">
          <p className="text-sm font-black uppercase tracking-wider text-slate-900">
            REPORT SHEET FOR{' '}
            <span className="inline-block px-3 border-b-2 border-black font-extrabold text-base text-slate-950">
              {assessment.term || settings.currentTerm}
            </span>{' '}
            TERM &bull; {assessment.academicSession || settings.currentSession}
          </p>
        </div>

        {/* Student Information & Class Statistics Box */}
        <div className="grid grid-cols-2 border-2 border-slate-900 text-xs mb-2">
          {/* Left Student Info */}
          <div className="border-r-2 border-slate-900 p-1.5 space-y-1">
            <div className="flex items-center">
              <span className="font-bold uppercase w-20 text-slate-950">NAME:</span>
              <span className="font-black uppercase text-slate-950 text-sm tracking-wide flex-1 border-b border-dotted border-slate-600 pl-1">
                {student.name}
              </span>
            </div>
            <div className="flex items-center">
              <span className="font-bold uppercase w-20 text-slate-950">CLASS:</span>
              <span className="font-bold text-slate-950 flex-1 border-b border-dotted border-slate-600 pl-1">
                {assessment.className || student.className}{' '}
                {assessment.section ? `(${assessment.section})` : student.section ? `(${student.section})` : ''}
              </span>
            </div>
            <div className="flex items-center">
              <span className="font-bold uppercase w-36 text-slate-950">STUDENTS IN CLASS:</span>
              <span className="font-black text-slate-950 border-b border-dotted border-slate-600 pl-1 flex-1">
                {stats.studentCount || 1}
              </span>
            </div>
          </div>

          {/* Right Class Performance */}
          <div className="p-1.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-slate-950">HIGHEST AVERAGE:</span>
              <span className="font-black text-slate-950 border-b border-dotted border-slate-600 px-2">
                {stats.highestAverage > 0 ? `${stats.highestAverage}%` : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-slate-950">LOWEST AVERAGE:</span>
              <span className="font-black text-slate-950 border-b border-dotted border-slate-600 px-2">
                {stats.lowestAverage > 0 ? `${stats.lowestAverage}%` : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-slate-950">CLASS AVERAGE:</span>
              <span className="font-black text-slate-950 border-b border-dotted border-slate-600 px-2">
                {stats.classAverage > 0 ? `${stats.classAverage}%` : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Academic Performance & Attendance Box */}
        <div className="grid grid-cols-2 border-2 border-slate-900 text-xs mb-2">
          {/* Left Performance */}
          <div className="border-r-2 border-slate-900 p-1.5 space-y-1 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-slate-950">TOTAL SCORE:</span>
              <span className="font-black text-slate-950 border-b border-dotted border-slate-600 px-2">
                {assessment.totalScore}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-slate-950">FINAL AVERAGE:</span>
              <span className="font-black text-slate-950 border-b border-dotted border-slate-600 px-2">
                {assessment.finalAverage}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-black uppercase text-slate-950">FINAL POSITION:</span>
              <span className="font-black text-slate-950 text-sm bg-slate-200 px-2 py-0.5 border border-slate-900">
                {assessment.finalPosition || '-'}
              </span>
            </div>
          </div>

          {/* Right Attendance */}
          <div className="p-1.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-slate-950">DAYS SCHOOL OPENED:</span>
              <span className="font-bold text-slate-950 border-b border-dotted border-slate-600 px-2">
                {assessment.daysOpened ?? '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-slate-950">DAYS PRESENT:</span>
              <span className="font-bold text-slate-950 border-b border-dotted border-slate-600 px-2">
                {assessment.daysPresent ?? '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-slate-950">DAYS ABSENT:</span>
              <span className="font-bold text-slate-950 border-b border-dotted border-slate-600 px-2">
                {assessment.daysAbsent ?? '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Cognitive Domain Table */}
        <div className="mb-2">
          <div className="flex items-center justify-between bg-slate-900 text-white px-2 py-1 text-xs font-bold uppercase">
            <span>COGNITIVE DOMAIN</span>
            <span>NO. OF SUBJECTS: {String(subjectScores.length).padStart(2, '0')}</span>
          </div>

          <table className="w-full border-collapse border-2 border-slate-900 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-950 font-bold border-b-2 border-slate-900 text-center">
                <th className="border-r border-slate-900 p-1 text-left w-36">Subject</th>
                <th className="border-r border-slate-900 p-1 w-16 text-center">
                  1<sup>st</sup> C.A ({settings.ca1Max}%)
                </th>
                <th className="border-r border-slate-900 p-1 w-16 text-center">
                  2<sup>nd</sup> C.A ({settings.ca2Max}%)
                </th>
                <th className="border-r border-slate-900 p-1 w-16 text-center">
                  Exam ({settings.examMax}%)
                </th>
                <th className="border-r border-slate-900 p-1 w-16 text-center font-black">
                  Total (100%)
                </th>
                <th className="border-r border-slate-900 p-1 w-14 text-center">Grade</th>
                <th className="border-r border-slate-900 p-1 w-14 text-center">Position</th>
                <th className="p-1 font-amiri text-sm text-right pr-2">المواد الدراسية</th>
              </tr>
            </thead>
            <tbody>
              {subjectScores.map((sub, index) => (
                <tr
                  key={sub.subjectId || index}
                  className={`border-b border-slate-900 ${
                    index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'
                  }`}
                >
                  <td className="border-r border-slate-900 p-1 font-semibold text-slate-950 text-left">
                    {sub.subjectName}
                  </td>
                  <td className="border-r border-slate-900 p-1 text-center font-medium">
                    {sub.ca1 !== undefined ? sub.ca1 : '-'}
                  </td>
                  <td className="border-r border-slate-900 p-1 text-center font-medium">
                    {sub.ca2 !== undefined ? sub.ca2 : '-'}
                  </td>
                  <td className="border-r border-slate-900 p-1 text-center font-medium">
                    {sub.exam !== undefined ? sub.exam : '-'}
                  </td>
                  <td className="border-r border-slate-900 p-1 text-center font-black text-slate-950 bg-slate-100/50">
                    {sub.total !== undefined ? sub.total : '-'}
                  </td>
                  <td className="border-r border-slate-900 p-1 text-center font-bold text-slate-950">
                    {sub.grade || '-'}
                  </td>
                  <td className="border-r border-slate-900 p-1 text-center font-semibold text-slate-800">
                    {sub.position || '-'}
                  </td>
                  <td className="p-1 font-amiri text-sm font-bold text-slate-950 text-right pr-2">
                    {sub.arabicName || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Side-by-side: Psychomotor (left) & Grade Details (right) */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          {/* Psychomotor Table */}
          <div className="border-2 border-slate-900">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold border-b border-slate-900">
                  <th className="p-1 text-left border-r border-slate-700">PSYCHOMOTOR</th>
                  <th className="p-1 text-center w-20">GRADE</th>
                </tr>
              </thead>
              <tbody>
                {psychomotorItems.map((item, idx) => {
                  const rating = assessment.psychomotorRatings?.[item.id] || assessment.psychomotorRatings?.[item.name] || '-';
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-slate-900 ${
                        idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'
                      }`}
                    >
                      <td className="p-1 font-medium text-slate-900 border-r border-slate-900">
                        {item.name}
                      </td>
                      <td className="p-1 text-center font-bold text-slate-950">
                        {rating}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Grade Details Table */}
          <div className="border-2 border-slate-900">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold border-b border-slate-900">
                  <th className="p-1 text-center" colSpan={2}>
                    GRADE DETAILS
                  </th>
                </tr>
              </thead>
              <tbody>
                {gradingBoundaries.map((b, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-slate-900 ${
                      idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'
                    }`}
                  >
                    <td className="p-1 text-center font-bold border-r border-slate-900 text-slate-950">
                      {Math.floor(b.min).toString().padStart(2, '0')} &ndash; {Math.floor(b.max)} = {b.grade}
                    </td>
                    <td className="p-1 text-center font-semibold text-slate-700">
                      {b.remark}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Teacher Information & School Closing / Resumption Box */}
        <div className="border-2 border-slate-900 text-xs p-1.5 space-y-1 mb-1">
          {/* Remark / Promotion */}
          <div className="flex items-center border-b border-slate-900 pb-1">
            <span className="font-extrabold uppercase text-slate-950 w-44">Remark:</span>
            <span className="font-black uppercase tracking-wider text-sm text-slate-950 bg-slate-100 px-2 py-0.5 border border-slate-800">
              {assessment.promotionRemark || 'PASS & PROMOTED'}
            </span>
          </div>

          {/* Form Teacher Name */}
          <div className="flex items-center border-b border-slate-300 pb-1">
            <span className="font-bold uppercase text-slate-950 w-48">FORM TEACHER&apos;S NAME:</span>
            <span className="font-bold text-slate-950 border-b border-dotted border-slate-500 pl-1 flex-1">
              {assessment.formTeacherName || 'Class Form Teacher'}
            </span>
          </div>

          {/* Form Teacher Comment */}
          <div className="flex items-start border-b border-slate-300 pb-1">
            <span className="font-bold uppercase text-slate-950 w-48 pt-0.5">
              FORM TEACHER&apos;S COMMENT:
            </span>
            <span className="font-semibold italic text-slate-950 border-b border-dotted border-slate-500 pl-1 flex-1 leading-snug">
              {assessment.formTeacherComment || 'Good academic performance. Keep it up.'}
            </span>
          </div>

          {/* School Closes */}
          <div className="flex items-center border-b border-slate-300 pb-1">
            <span className="font-bold uppercase text-slate-950 w-48">School closes:</span>
            <span className="font-semibold text-slate-950 border-b border-dotted border-slate-500 pl-1 flex-1">
              {assessment.schoolCloses || '24th Dhul Hijjah 1447 / 10th June 2026'}
            </span>
          </div>

          {/* Next Term Begins */}
          <div className="flex items-center border-b border-slate-300 pb-1">
            <span className="font-bold uppercase text-slate-950 w-48">NEXT TERM BEGINS:</span>
            <span className="font-semibold text-slate-950 border-b border-dotted border-slate-500 pl-1 flex-1">
              {assessment.nextTermBegins || '04th Muharram 1448 / 20th July 2026'}
            </span>
          </div>

          {/* Next Term Fees */}
          <div className="flex items-center">
            <span className="font-bold uppercase text-slate-950 w-48">NEXT TERM SCHOOL FEES:</span>
            <span className="font-bold text-slate-950 border-b border-dotted border-slate-500 pl-1 flex-1">
              {assessment.nextTermFees || '₦ 16,000'}
            </span>
          </div>
        </div>

        {/* Footer Credit (matching sample document) */}
        <div className="text-center pt-1 border-t border-slate-900 text-[10px] text-slate-800 font-bold tracking-wider">
          M-SAGEER DIGITAL TECHNOLOGIES LTD &bull; 07066979027
        </div>
      </div>
    </div>
  );
};
