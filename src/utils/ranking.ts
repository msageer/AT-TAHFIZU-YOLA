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
