import { GradeBoundary, AssessmentRecord, SubjectScore } from '../types';

export function getOrdinal(n: number): string {
  if (isNaN(n) || n <= 0) return '-';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function calculateGrade(score: number, boundaries: GradeBoundary[]): { grade: string; remark: string } {
  const rounded = Math.round(score * 10) / 10;
  for (const b of boundaries) {
    if (rounded >= b.min && rounded <= b.max) {
      return { grade: b.grade, remark: b.remark };
    }
  }
  if (rounded >= 70) return { grade: 'A', remark: 'Excellent' };
  if (rounded >= 60) return { grade: 'B', remark: 'Very Good' };
  if (rounded >= 50) return { grade: 'C', remark: 'Good' };
  if (rounded >= 45) return { grade: 'D', remark: 'Pass' };
  if (rounded >= 40) return { grade: 'E', remark: 'Fair' };
  return { grade: 'F', remark: 'Fail' };
}

export interface ClassStatistics {
  studentCount: number;
  highestAverage: number;
  lowestAverage: number;
  classAverage: number;
}

export function computeClassStatistics(assessments: AssessmentRecord[]): ClassStatistics {
  if (!assessments || assessments.length === 0) {
    return {
      studentCount: 0,
      highestAverage: 0,
      lowestAverage: 0,
      classAverage: 0,
    };
  }

  const averages = assessments.map(a => a.finalAverage).filter(avg => typeof avg === 'number' && !isNaN(avg));
  if (averages.length === 0) {
    return {
      studentCount: assessments.length,
      highestAverage: 0,
      lowestAverage: 0,
      classAverage: 0,
    };
  }

  const highest = Math.max(...averages);
  const lowest = Math.min(...averages);
  const sum = averages.reduce((acc, curr) => acc + curr, 0);
  const classAvg = sum / averages.length;

  return {
    studentCount: assessments.length,
    highestAverage: Math.round(highest * 10) / 10,
    lowestAverage: Math.round(lowest * 10) / 10,
    classAverage: Math.round(classAvg * 10) / 10,
  };
}

/**
 * Assigns ranks to class assessment records:
 * 1. Final position based on finalAverage / totalScore descending
 * 2. Subject position for each subject among class peers
 */
export function rankAssessments(assessments: AssessmentRecord[]): AssessmentRecord[] {
  if (!assessments || assessments.length === 0) return [];

  // Sort by final average descending (then total score descending)
  const sorted = [...assessments].sort((a, b) => {
    if (b.finalAverage !== a.finalAverage) {
      return b.finalAverage - a.finalAverage;
    }
    return b.totalScore - a.totalScore;
  });

  // Assign overall positions with tie handling (Standard Competition Ranking 1224)
  let currentRank = 1;
  const withOverallRanks = sorted.map((record, index) => {
    if (index > 0) {
      const prev = sorted[index - 1];
      if (prev.finalAverage !== record.finalAverage) {
        currentRank = index + 1;
      }
    } else {
      currentRank = 1;
    }
    return {
      ...record,
      finalPosition: getOrdinal(currentRank),
    };
  });

  // Calculate subject-level ranks across this group
  // Extract all distinct subject IDs
  const subjectIds = new Set<string>();
  withOverallRanks.forEach(rec => {
    rec.subjectScores?.forEach(sc => subjectIds.add(sc.subjectId));
  });

  // Map each subject to sorted student records
  const subjectRankings: Record<string, Record<string, string>> = {};

  subjectIds.forEach(subId => {
    const scoresForSub = withOverallRanks
      .map(rec => {
        const sc = rec.subjectScores?.find(s => s.subjectId === subId);
        return {
          studentId: rec.studentId,
          total: sc ? sc.total : -1,
        };
      })
      .filter(item => item.total >= 0)
      .sort((a, b) => b.total - a.total);

    subjectRankings[subId] = {};
    let sRank = 1;
    scoresForSub.forEach((item, idx) => {
      if (idx > 0 && scoresForSub[idx - 1].total !== item.total) {
        sRank = idx + 1;
      }
      subjectRankings[subId][item.studentId] = getOrdinal(sRank);
    });
  });

  // Update subject positions on each record
  return withOverallRanks.map(rec => {
    const updatedScores = rec.subjectScores?.map(sc => ({
      ...sc,
      position: subjectRankings[sc.subjectId]?.[rec.studentId] || '-',
    })) || [];

    return {
      ...rec,
      subjectScores: updatedScores,
    };
  });
}

/**
 * Converts a percentage score (0-100) to standard 4.0 scale GPA
 */
export function calculateGpaFromAverage(average: number): number {
  if (isNaN(average) || average <= 0) return 0.0;
  if (average >= 70) {
    // 70 - 100 maps to 3.50 - 4.00
    const gpa = 3.5 + ((average - 70) / 30) * 0.5;
    return Math.min(4.0, Math.round(gpa * 100) / 100);
  }
  if (average >= 60) {
    // 60 - 69.9 maps to 3.00 - 3.49
    const gpa = 3.0 + ((average - 60) / 10) * 0.49;
    return Math.round(gpa * 100) / 100;
  }
  if (average >= 50) {
    // 50 - 59.9 maps to 2.00 - 2.99
    const gpa = 2.0 + ((average - 50) / 10) * 0.99;
    return Math.round(gpa * 100) / 100;
  }
  if (average >= 45) {
    // 45 - 49.9 maps to 1.00 - 1.99
    const gpa = 1.0 + ((average - 45) / 5) * 0.99;
    return Math.round(gpa * 100) / 100;
  }
  // 0 - 44.9 maps to 0.00 - 0.99
  const gpa = (average / 45) * 0.99;
  return Math.round(gpa * 100) / 100;
}

export interface PerformanceBucket {
  id: string;
  rangeLabel: string;
  title: string;
  arabicTitle: string;
  count: number;
  percentage: number;
  barColor: string;
  bgLight: string;
  borderLight: string;
  textColor: string;
  students: Array<{
    studentId: string;
    name: string;
    className: string;
    section: string;
    gpa: number;
    average: number;
  }>;
}

export interface SessionDistributionSummary {
  totalAssessed: number;
  averageGpa: number;
  averageScore: number;
  highestGpa: number;
  highestScore: number;
  lowestGpa: number;
  lowestScore: number;
  passRate: number; // Percentage with GPA >= 2.0 or score >= 50%
  topStudentName?: string;
  buckets: PerformanceBucket[];
}

/**
 * Computes student performance distribution (GPA / score buckets) for given assessments
 */
export function computeGpaDistribution(
  assessments: AssessmentRecord[],
  studentsList: { id: string; studentId: string; name: string }[]
): SessionDistributionSummary {
  const studentMap = new Map<string, string>();
  studentsList.forEach(s => studentMap.set(s.studentId, s.name));

  if (!assessments || assessments.length === 0) {
    const emptyBuckets: PerformanceBucket[] = [
      {
        id: 'distinction',
        rangeLabel: '3.80 - 4.00',
        title: 'Distinction / 1st Class',
        arabicTitle: 'ممتاز مرتفع',
        count: 0,
        percentage: 0,
        barColor: 'from-emerald-500 to-teal-600',
        bgLight: 'bg-emerald-50',
        borderLight: 'border-emerald-200',
        textColor: 'text-emerald-800',
        students: [],
      },
      {
        id: 'upper-credit',
        rangeLabel: '3.30 - 3.79',
        title: 'Upper Credit / Very Good',
        arabicTitle: 'جيد جداً',
        count: 0,
        percentage: 0,
        barColor: 'from-blue-500 to-indigo-600',
        bgLight: 'bg-blue-50',
        borderLight: 'border-blue-200',
        textColor: 'text-blue-800',
        students: [],
      },
      {
        id: 'credit',
        rangeLabel: '2.80 - 3.29',
        title: 'Credit / Good',
        arabicTitle: 'جيد',
        count: 0,
        percentage: 0,
        barColor: 'from-cyan-500 to-blue-600',
        bgLight: 'bg-cyan-50',
        borderLight: 'border-cyan-200',
        textColor: 'text-cyan-800',
        students: [],
      },
      {
        id: 'pass',
        rangeLabel: '2.00 - 2.79',
        title: 'Pass / Fair',
        arabicTitle: 'مقبول',
        count: 0,
        percentage: 0,
        barColor: 'from-amber-400 to-amber-500',
        bgLight: 'bg-amber-50',
        borderLight: 'border-amber-200',
        textColor: 'text-amber-800',
        students: [],
      },
      {
        id: 'fail',
        rangeLabel: '0.00 - 1.99',
        title: 'Needs Support / Fail',
        arabicTitle: 'راسب / يحتاج دعم',
        count: 0,
        percentage: 0,
        barColor: 'from-rose-500 to-red-600',
        bgLight: 'bg-rose-50',
        borderLight: 'border-rose-200',
        textColor: 'text-rose-800',
        students: [],
      },
    ];

    return {
      totalAssessed: 0,
      averageGpa: 0,
      averageScore: 0,
      highestGpa: 0,
      highestScore: 0,
      lowestGpa: 0,
      lowestScore: 0,
      passRate: 0,
      buckets: emptyBuckets,
    };
  }

  // Deduplicate assessments by studentId (if multiple terms, calculate student's session average)
  const studentRecordsMap = new Map<
    string,
    {
      studentId: string;
      name: string;
      className: string;
      section: string;
      averages: number[];
    }
  >();

  assessments.forEach(a => {
    const existing = studentRecordsMap.get(a.studentId);
    if (existing) {
      existing.averages.push(a.finalAverage);
    } else {
      studentRecordsMap.set(a.studentId, {
        studentId: a.studentId,
        name: studentMap.get(a.studentId) || a.studentId,
        className: a.className,
        section: a.section,
        averages: [a.finalAverage],
      });
    }
  });

  const studentEvaluations = Array.from(studentRecordsMap.values()).map(item => {
    const avgScore =
      item.averages.length > 0
        ? Math.round((item.averages.reduce((sum, v) => sum + v, 0) / item.averages.length) * 10) /
          10
        : 0;
    const gpa = calculateGpaFromAverage(avgScore);
    return {
      studentId: item.studentId,
      name: item.name,
      className: item.className,
      section: item.section,
      average: avgScore,
      gpa,
    };
  });

  const totalAssessed = studentEvaluations.length;
  const gpas = studentEvaluations.map(s => s.gpa);
  const scores = studentEvaluations.map(s => s.average);

  const highestGpa = Math.max(...gpas);
  const lowestGpa = Math.min(...gpas);
  const highestScore = Math.max(...scores);
  const lowestScore = Math.min(...scores);
  const averageGpa =
    Math.round((gpas.reduce((sum, v) => sum + v, 0) / totalAssessed) * 100) / 100;
  const averageScore =
    Math.round((scores.reduce((sum, v) => sum + v, 0) / totalAssessed) * 10) / 10;
  const passCount = studentEvaluations.filter(s => s.gpa >= 2.0 || s.average >= 50).length;
  const passRate = totalAssessed > 0 ? Math.round((passCount / totalAssessed) * 1000) / 10 : 0;

  const topStudent = studentEvaluations.find(s => s.gpa === highestGpa);

  // Group into 5 buckets
  const bDistinction = studentEvaluations.filter(s => s.gpa >= 3.8);
  const bUpper = studentEvaluations.filter(s => s.gpa >= 3.3 && s.gpa < 3.8);
  const bCredit = studentEvaluations.filter(s => s.gpa >= 2.8 && s.gpa < 3.3);
  const bPass = studentEvaluations.filter(s => s.gpa >= 2.0 && s.gpa < 2.8);
  const bFail = studentEvaluations.filter(s => s.gpa < 2.0);

  const buckets: PerformanceBucket[] = [
    {
      id: 'distinction',
      rangeLabel: '3.80 - 4.00',
      title: 'Distinction / 1st Class',
      arabicTitle: 'ممتاز مرتفع',
      count: bDistinction.length,
      percentage: totalAssessed > 0 ? Math.round((bDistinction.length / totalAssessed) * 100) : 0,
      barColor: 'from-emerald-500 to-teal-600',
      bgLight: 'bg-emerald-50',
      borderLight: 'border-emerald-200',
      textColor: 'text-emerald-800',
      students: bDistinction,
    },
    {
      id: 'upper-credit',
      rangeLabel: '3.30 - 3.79',
      title: 'Upper Credit / Very Good',
      arabicTitle: 'جيد جداً',
      count: bUpper.length,
      percentage: totalAssessed > 0 ? Math.round((bUpper.length / totalAssessed) * 100) : 0,
      barColor: 'from-blue-500 to-indigo-600',
      bgLight: 'bg-blue-50',
      borderLight: 'border-blue-200',
      textColor: 'text-blue-800',
      students: bUpper,
    },
    {
      id: 'credit',
      rangeLabel: '2.80 - 3.29',
      title: 'Credit / Good',
      arabicTitle: 'جيد',
      count: bCredit.length,
      percentage: totalAssessed > 0 ? Math.round((bCredit.length / totalAssessed) * 100) : 0,
      barColor: 'from-cyan-500 to-blue-600',
      bgLight: 'bg-cyan-50',
      borderLight: 'border-cyan-200',
      textColor: 'text-cyan-800',
      students: bCredit,
    },
    {
      id: 'pass',
      rangeLabel: '2.00 - 2.79',
      title: 'Pass / Fair',
      arabicTitle: 'مقبول',
      count: bPass.length,
      percentage: totalAssessed > 0 ? Math.round((bPass.length / totalAssessed) * 100) : 0,
      barColor: 'from-amber-400 to-amber-500',
      bgLight: 'bg-amber-50',
      borderLight: 'border-amber-200',
      textColor: 'text-amber-800',
      students: bPass,
    },
    {
      id: 'fail',
      rangeLabel: '0.00 - 1.99',
      title: 'Needs Support / Fail',
      arabicTitle: 'راسب / يحتاج دعم',
      count: bFail.length,
      percentage: totalAssessed > 0 ? Math.round((bFail.length / totalAssessed) * 100) : 0,
      barColor: 'from-rose-500 to-red-600',
      bgLight: 'bg-rose-50',
      borderLight: 'border-rose-200',
      textColor: 'text-rose-800',
      students: bFail,
    },
  ];

  return {
    totalAssessed,
    averageGpa,
    averageScore,
    highestGpa,
    highestScore,
    lowestGpa,
    lowestScore,
    passRate,
    topStudentName: topStudent?.name,
    buckets,
  };
}
