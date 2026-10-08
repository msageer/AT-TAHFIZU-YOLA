import React, { useMemo } from 'react';
import { SchoolSettings, Student, AssessmentRecord, GradeBoundary, PsychomotorItem, ClassItem, UserAccount } from '../types';
import { ClassStatistics } from '../utils/ranking';
import { formatClassWithSection } from '../utils/classSections';

interface ReportSheetProps {
  settings: SchoolSettings;
  student: Student;
  assessment: AssessmentRecord;
  stats: ClassStatistics;
  gradingBoundaries: GradeBoundary[];
  psychomotorItems: PsychomotorItem[];
  classes?: ClassItem[];
  users?: UserAccount[];
}

export const ReportSheet: React.FC<ReportSheetProps> = ({
  settings,
  student,
  assessment,
  stats,
  gradingBoundaries,
  psychomotorItems,
  classes = [],
  users = [],
}) => {
  const subjectScores = assessment.subjectScores || [];
  const isCompact = subjectScores.length > 8;

  // Resolve per-class school fees and teacher information from settings / class configuration
  const targetClassName = assessment.className || student.className;
  const studentSection = assessment.section || student.section;
  const cleanClassName = (targetClassName || '').toLowerCase().trim();

  const matchedClass = classes.find(
    c => c.name.toLowerCase().trim() === cleanClassName
  );

  // Term-specific calendar and school fees resolution
  const studentTerm = assessment.term || settings.currentTerm || '1st Term';
  const termCfg = settings.termSettings?.[studentTerm];

  // Helper to format fee currency cleanly
  const formatFeeDisplay = (val?: string | number): string => {
    if (!val) return '₦ 16,000';
    const s = String(val).trim();
    if (!s) return '₦ 16,000';
    if (s.startsWith('₦') || s.startsWith('$') || s.toLowerCase().startsWith('ngn')) {
      return s;
    }
    const num = Number(s.replace(/[^0-9.]/g, ''));
    if (!isNaN(num) && num > 0) {
      return `₦ ${num.toLocaleString()}`;
    }
    return s;
  };

  // Fees automatically fetched from term fees added on school setup / class setup
  const rawFees =
    matchedClass?.termFees?.[studentTerm] ||
    termCfg?.classFees?.[targetClassName] ||
    matchedClass?.nextTermFees ||
    termCfg?.defaultFees ||
    settings.classFees?.[targetClassName] ||
    assessment.nextTermFees ||
    settings.defaultNextTermFees ||
    '₦ 16,000';

  const resolvedFees = formatFeeDisplay(rawFees);

  // Next term dates automatically fetched from term settings on school setup
  const resolvedSchoolCloses =
    termCfg?.schoolCloses ||
    settings.schoolCloses ||
    assessment.schoolCloses ||
    '24th Dhul Hijjah 1447 / 10th June 2026';

  const resolvedNextTermBegins =
    termCfg?.nextTermBegins ||
    settings.nextTermBegins ||
    assessment.nextTermBegins ||
    '04th Muharram 1448 / 20th July 2026';

  // Automatically fetch Form Teacher's name from available roles in school setup
  const resolvedFormTeacher = useMemo(() => {
    // 1. Direct match: Teacher from users with role 'teacher' or 'staff' assigned to this class and section
    if (users && users.length > 0) {
      if (studentSection) {
        const teacherWithSection = users.find(
          u =>
            (u.role === 'teacher' || u.role === 'staff') &&
            u.assignedClass?.toLowerCase().trim() === cleanClassName &&
            u.assignedSection?.toUpperCase().trim() === studentSection.toUpperCase().trim() &&
            u.status !== 'disabled'
        );
        if (teacherWithSection?.fullName?.trim()) {
          return teacherWithSection.fullName.trim();
        }
      }

      // 2. Teacher from users assigned to this class
      const teacherForClass = users.find(
        u =>
          (u.role === 'teacher' || u.role === 'staff') &&
          u.assignedClass?.toLowerCase().trim() === cleanClassName &&
          u.status !== 'disabled'
      );
      if (teacherForClass?.fullName?.trim()) {
        return teacherForClass.fullName.trim();
      }
    }

    // 3. Class configuration form teacher from School Setup -> Classes
    if (matchedClass?.classTeacherName?.trim()) {
      return matchedClass.classTeacherName.trim();
    }

    // 4. Assessment record saved form teacher name (if customized)
    if (
      assessment.formTeacherName &&
      assessment.formTeacherName.trim() &&
      assessment.formTeacherName.trim().toLowerCase() !== 'class form teacher'
    ) {
      return assessment.formTeacherName.trim();
    }

    // 5. Any active teacher account in available roles
    if (users && users.length > 0) {
      const anyTeacher = users.find(u => u.role === 'teacher' && u.status !== 'disabled');
      if (anyTeacher?.fullName?.trim()) {
        return anyTeacher.fullName.trim();
      }
    }

    return 'Class Form Teacher';
  }, [users, studentSection, cleanClassName, matchedClass, assessment.formTeacherName]);

  // Automatically fetch Head Teacher / Headmaster name from school settings or administration
  const resolvedHeadTeacher = useMemo(() => {
    // 1. Configured in School Setup settings
    if (settings.headTeacherName && settings.headTeacherName.trim()) {
      return settings.headTeacherName.trim();
    }
    // 2. Custom override on student assessment record
    if (assessment.headTeacherName && assessment.headTeacherName.trim()) {
      return assessment.headTeacherName.trim();
    }
    // 3. Registered super admin or head staff
    if (users && users.length > 0) {
      const superAdmin = users.find(u => u.role === 'super_admin' && u.status !== 'disabled');
      if (superAdmin?.fullName?.trim()) {
        return superAdmin.fullName.trim();
      }
    }
    return 'Ustaz Al-Amin Kaigama';
  }, [settings.headTeacherName, assessment.headTeacherName, users]);

  const resolvedHeadTeacherComment = useMemo(() => {
    if (assessment.headTeacherComment && assessment.headTeacherComment.trim()) {
      return assessment.headTeacherComment.trim();
    }
    return 'A commendable academic performance. Strive to maintain this standard.';
  }, [assessment.headTeacherComment]);

  return (
    <div className="report-sheet-root relative bg-white text-black p-2.5 sm:p-3 mx-auto font-sans leading-tight border-2 border-black rounded-none shadow-sm w-full max-w-[200mm] min-h-[280mm] max-h-[285mm] box-border print:border-2 print:border-black print:p-2 print:shadow-none print:w-full print:h-full print:max-h-[285mm] overflow-hidden flex flex-col justify-between">
      {/* Background Watermark */}
      {settings.logoUrl && (
        <div
          className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.035] overflow-hidden"
          style={{ zIndex: 0 }}
        >
          <img
            src={settings.logoUrl}
            alt="School Watermark"
            className="w-[300px] h-[300px] object-contain grayscale"
          />
        </div>
      )}

      <div className="relative z-10 flex flex-col justify-between h-full">
        {/* Top Header with Double Border Frame */}
        <div className={`border-2 border-slate-900 ${isCompact ? 'p-1' : 'p-1.5'} text-center mb-1`}>
          <div className="flex items-center justify-between gap-2">
            {/* Logo */}
            <div className={`${isCompact ? 'w-14 h-14' : 'w-16 h-16'} flex-shrink-0 flex items-center justify-center`}>
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt="School Logo"
                  className={`${isCompact ? 'max-h-14 max-w-14' : 'max-h-16 max-w-16'} object-contain`}
                />
              ) : (
                <div className="w-14 h-14 border border-dashed border-gray-400 flex items-center justify-center text-[10px] text-gray-400">
                  Logo
                </div>
              )}
            </div>

            {/* School Text */}
            <div className="flex-1 px-1">
              <h2 className="font-amiri text-lg sm:text-xl font-bold tracking-wide text-slate-950 leading-snug">
                {settings.arabicSchoolName || 'التحفيظ والإتقان الإسلامية، يولا'}
              </h2>
              <h1 className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-950 leading-tight">
                {settings.schoolName || 'AT-TAHFIZU WAL ITQAN ISLAMIYYA, YOLA'}
              </h1>
              <p className="text-[9.5px] font-semibold text-slate-800 italic">
                {settings.motto || 'Motto: خيركم من تعلم القرآن وعلمه'}
              </p>
              <p className="text-[9px] text-slate-800 font-medium leading-tight">
                <span className="font-bold">ADDRESS:</span> {settings.address}
              </p>
              <p className="text-[9px] text-slate-800 font-medium leading-tight">
                <span className="font-bold">Tel. No:</span> {settings.telephone}
                {settings.email ? ` | ${settings.email}` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Report Sheet Title */}
        <div className="text-center my-0.5 border-b-2 border-dashed border-slate-800 pb-0.5">
          <p className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900">
            REPORT SHEET FOR{' '}
            <span className="inline-block px-2 border-b-2 border-black font-extrabold text-sm text-slate-950">
              {assessment.term || settings.currentTerm}
            </span>{' '}
            TERM &bull; {assessment.academicSession || settings.currentSession}
          </p>
        </div>

        {/* Student Information & Class Statistics Box */}
        <div className="grid grid-cols-2 border-2 border-slate-900 text-[11px] mb-1">
          {/* Left Student Info */}
          <div className="border-r-2 border-slate-900 p-1 space-y-0.5">
            <div className="flex items-center">
              <span className="font-bold uppercase w-16 text-slate-950">NAME:</span>
              <span className="font-black uppercase text-slate-950 text-xs tracking-wide flex-1 border-b border-dotted border-slate-600 pl-1 truncate">
                {student.name}
              </span>
            </div>
            <div className="flex items-center">
              <span className="font-bold uppercase w-16 text-slate-950">CLASS:</span>
              <span className="font-bold text-slate-950 flex-1 border-b border-dotted border-slate-600 pl-1 truncate">
                {formatClassWithSection(
                  assessment.className || student.className,
                  assessment.section || student.section,
                  classes
                )}
              </span>
            </div>
            <div className="flex items-center">
              <span className="font-bold uppercase w-32 text-slate-950">STUDENTS IN CLASS:</span>
              <span className="font-black text-slate-950 border-b border-dotted border-slate-600 pl-1 flex-1">
                {stats.studentCount || 1}
              </span>
            </div>
          </div>

          {/* Right Class Performance */}
          <div className="p-1 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-slate-950">HIGHEST AVERAGE:</span>
              <span className="font-black text-slate-950 border-b border-dotted border-slate-600 px-1.5">
                {stats.highestAverage > 0 ? `${stats.highestAverage}%` : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-slate-950">LOWEST AVERAGE:</span>
              <span className="font-black text-slate-950 border-b border-dotted border-slate-600 px-1.5">
                {stats.lowestAverage > 0 ? `${stats.lowestAverage}%` : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-slate-950">CLASS AVERAGE:</span>
              <span className="font-black text-slate-950 border-b border-dotted border-slate-600 px-1.5">
                {stats.classAverage > 0 ? `${stats.classAverage}%` : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Academic Performance & Attendance Box */}
        <div className="grid grid-cols-2 border-2 border-slate-900 text-[11px] mb-1">
          {/* Left Performance */}
          <div className="border-r-2 border-slate-900 p-1 space-y-0.5 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-slate-950">TOTAL SCORE:</span>
              <span className="font-black text-slate-950 border-b border-dotted border-slate-600 px-1.5">
                {assessment.totalScore}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-slate-950">FINAL AVERAGE:</span>
              <span className="font-black text-slate-950 border-b border-dotted border-slate-600 px-1.5">
                {assessment.finalAverage}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-black uppercase text-slate-950">FINAL POSITION:</span>
              <span className="font-black text-slate-950 text-xs bg-slate-200 px-1.5 py-0.2 border border-slate-900">
                {assessment.finalPosition || '-'}
              </span>
            </div>
          </div>

          {/* Right Attendance */}
          <div className="p-1 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-slate-950">DAYS SCHOOL OPENED:</span>
              <span className="font-bold text-slate-950 border-b border-dotted border-slate-600 px-1.5">
                {assessment.daysOpened ?? '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-slate-950">DAYS PRESENT:</span>
              <span className="font-bold text-slate-950 border-b border-dotted border-slate-600 px-1.5">
                {assessment.daysPresent ?? '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-slate-950">DAYS ABSENT:</span>
              <span className="font-bold text-slate-950 border-b border-dotted border-slate-600 px-1.5">
                {assessment.daysAbsent ?? '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Cognitive Domain Table */}
        <div className="mb-1">
          <div className="flex items-center justify-between bg-slate-900 text-white px-2 py-0.5 text-[10px] sm:text-[11px] font-bold uppercase">
            <span>COGNITIVE DOMAIN</span>
            <span>NO. OF SUBJECTS: {String(subjectScores.length).padStart(2, '0')}</span>
          </div>

          <table className="w-full border-collapse border-2 border-slate-900 text-[10px] sm:text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-slate-950 font-bold border-b-2 border-slate-900 text-center">
                <th className="border-r border-slate-900 py-0.5 px-1 text-left w-36">Subject</th>
                <th className="border-r border-slate-900 py-0.5 px-0.5 w-14 text-center">
                  1<sup>st</sup> C.A ({settings.ca1Max}%)
                </th>
                <th className="border-r border-slate-900 py-0.5 px-0.5 w-14 text-center">
                  2<sup>nd</sup> C.A ({settings.ca2Max}%)
                </th>
                <th className="border-r border-slate-900 py-0.5 px-0.5 w-14 text-center">
                  Exam ({settings.examMax}%)
                </th>
                <th className="border-r border-slate-900 py-0.5 px-0.5 w-14 text-center font-black">
                  Total (100%)
                </th>
                <th className="border-r border-slate-900 py-0.5 px-0.5 w-12 text-center">Grade</th>
                <th className="border-r border-slate-900 py-0.5 px-0.5 w-12 text-center">Position</th>
                <th className="py-0.5 px-1 font-amiri text-xs text-right pr-1.5">المواد الدراسية</th>
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
                  <td className="border-r border-slate-900 py-0.5 px-1 font-semibold text-slate-950 text-left truncate">
                    {sub.subjectName}
                  </td>
                  <td className="border-r border-slate-900 py-0.5 px-0.5 text-center font-medium">
                    {sub.ca1 !== undefined ? sub.ca1 : '-'}
                  </td>
                  <td className="border-r border-slate-900 py-0.5 px-0.5 text-center font-medium">
                    {sub.ca2 !== undefined ? sub.ca2 : '-'}
                  </td>
                  <td className="border-r border-slate-900 py-0.5 px-0.5 text-center font-medium">
                    {sub.exam !== undefined ? sub.exam : '-'}
                  </td>
                  <td className="border-r border-slate-900 py-0.5 px-0.5 text-center font-black text-slate-950 bg-slate-100/50">
                    {sub.total !== undefined ? sub.total : '-'}
                  </td>
                  <td className="border-r border-slate-900 py-0.5 px-0.5 text-center font-bold text-slate-950">
                    {sub.grade || '-'}
                  </td>
                  <td className="border-r border-slate-900 py-0.5 px-0.5 text-center font-semibold text-slate-800">
                    {sub.position || '-'}
                  </td>
                  <td className="py-0.5 px-1 font-amiri text-xs font-bold text-slate-950 text-right pr-1.5 truncate">
                    {sub.arabicName || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Side-by-side: Psychomotor (left) & Grade Details (right) */}
        <div className="grid grid-cols-2 gap-1.5 mb-1">
          {/* Psychomotor Table */}
          <div className="border-2 border-slate-900">
            <table className="w-full text-[10px] sm:text-[11px]">
              <thead>
                <tr className="bg-slate-900 text-white font-bold border-b border-slate-900">
                  <th className="py-0.5 px-1 text-left border-r border-slate-700">PSYCHOMOTOR</th>
                  <th className="py-0.5 px-1 text-center w-16">GRADE</th>
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
                      <td className="py-0.5 px-1 font-medium text-slate-900 border-r border-slate-900 truncate">
                        {item.name}
                      </td>
                      <td className="py-0.5 px-1 text-center font-bold text-slate-950">
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
            <table className="w-full text-[10px] sm:text-[11px]">
              <thead>
                <tr className="bg-slate-900 text-white font-bold border-b border-slate-900">
                  <th className="py-0.5 px-1 text-center" colSpan={2}>
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
                    <td className="py-0.5 px-1 text-center font-bold border-r border-slate-900 text-slate-950">
                      {Math.floor(b.min).toString().padStart(2, '0')} &ndash; {Math.floor(b.max)} = {b.grade}
                    </td>
                    <td className="py-0.5 px-1 text-center font-semibold text-slate-700 truncate">
                      {b.remark}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Teacher Information & School Closing / Resumption Box */}
        <div className="border-2 border-slate-900 text-[10px] sm:text-[10.5px] p-1 space-y-0.5 mb-0.5">
          {/* Remark / Promotion */}
          <div className="flex items-center border-b border-slate-900 pb-0.5">
            <span className="font-extrabold uppercase text-slate-950 w-44">Remark:</span>
            <span className="font-black uppercase tracking-wider text-xs text-slate-950 bg-slate-100 px-1.5 py-0.2 border border-slate-800">
              {assessment.promotionRemark || 'PASS & PROMOTED'}
            </span>
          </div>

          {/* Form Teacher Name & Signature */}
          <div className="flex items-center border-b border-slate-300 pb-0.5">
            <span className="font-bold uppercase text-slate-950 w-48">FORM TEACHER&apos;S NAME:</span>
            <span className="font-bold text-slate-950 border-b border-dotted border-slate-500 pl-1 flex-1 truncate">
              {resolvedFormTeacher}
            </span>
            <span className="font-bold text-[9px] uppercase text-slate-700 ml-2 whitespace-nowrap">
              Sign / Stamp: ________________
            </span>
          </div>

          {/* Form Teacher Comment */}
          <div className="flex items-start border-b border-slate-300 pb-0.5">
            <span className="font-bold uppercase text-slate-950 w-48 pt-0.2">
              FORM TEACHER&apos;S COMMENT:
            </span>
            <span className="font-semibold italic text-slate-950 border-b border-dotted border-slate-500 pl-1 flex-1 leading-tight truncate">
              {assessment.formTeacherComment || 'Good academic performance. Keep it up.'}
            </span>
          </div>

          {/* Head Teacher / Headmaster Name & Signature */}
          <div className="flex items-center border-b border-slate-300 pb-0.5">
            <span className="font-bold uppercase text-slate-950 w-48">HEAD TEACHER / HEADMASTER:</span>
            <span className="font-bold text-slate-950 border-b border-dotted border-slate-500 pl-1 flex-1 truncate">
              {resolvedHeadTeacher}
            </span>
            <span className="font-bold text-[9px] uppercase text-slate-700 ml-2 whitespace-nowrap">
              Sign / Stamp: ________________
            </span>
          </div>

          {/* Head Teacher Comment */}
          <div className="flex items-start border-b border-slate-300 pb-0.5">
            <span className="font-bold uppercase text-slate-950 w-48 pt-0.2">
              HEAD TEACHER&apos;S COMMENT:
            </span>
            <span className="font-semibold italic text-slate-950 border-b border-dotted border-slate-500 pl-1 flex-1 leading-tight truncate">
              {resolvedHeadTeacherComment}
            </span>
          </div>

          {/* School Closes, Next Term Begins & Next Term Fees */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 pt-0.5 text-[9.5px] sm:text-[10px]">
            <div className="flex items-center">
              <span className="font-bold uppercase text-slate-950 mr-1 whitespace-nowrap">School closes:</span>
              <span className="font-semibold text-slate-950 border-b border-dotted border-slate-500 truncate flex-1">
                {resolvedSchoolCloses}
              </span>
            </div>
            <div className="flex items-center">
              <span className="font-bold uppercase text-slate-950 mr-1 whitespace-nowrap">NEXT TERM BEGINS:</span>
              <span className="font-bold text-slate-950 border-b border-dotted border-slate-500 truncate flex-1">
                {resolvedNextTermBegins}
              </span>
            </div>
            <div className="flex items-center">
              <span className="font-bold uppercase text-slate-950 mr-1 whitespace-nowrap">NEXT TERM FEES:</span>
              <span className="font-black text-slate-950 border-b border-dotted border-slate-500 truncate flex-1">
                {resolvedFees}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Credit (matching sample document) */}
        <div className="text-center pt-0.5 border-t border-slate-900 text-[9px] text-slate-800 font-bold tracking-wider">
          M-SAGEER DIGITAL TECHNOLOGIES LTD &bull; 07066979027
        </div>
      </div>
    </div>
  );
};
