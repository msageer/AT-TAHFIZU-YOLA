import { SubjectItem, ClassItem } from '../types';

/**
 * Checks if a subject is assigned to / applicable for a specific class.
 *
 * Rules:
 * 1. Must be active (isActive !== false).
 * 2. If applicableClasses is empty, undefined, or includes 'ALL', it applies to all classes.
 * 3. Otherwise, checks if the target className or its corresponding classId is present in applicableClasses.
 */
export function isSubjectApplicableToClass(
  subject: SubjectItem,
  className: string,
  classes?: ClassItem[]
): boolean {
  if (!subject.isActive) return false;
  if (!subject.applicableClasses || subject.applicableClasses.length === 0) {
    return true; // Default: all classes take this subject
  }
  if (subject.applicableClasses.includes('ALL')) {
    return true;
  }

  const targetClassLower = (className || '').toLowerCase().trim();
  const matchedClassObj = classes?.find(
    c => c.name.toLowerCase().trim() === targetClassLower || c.id === className
  );

  return subject.applicableClasses.some(appClass => {
    const appClassLower = appClass.toLowerCase().trim();
    if (appClassLower === targetClassLower) return true;
    if (matchedClassObj && (appClass === matchedClassObj.id || appClassLower === matchedClassObj.name.toLowerCase().trim())) {
      return true;
    }
    return false;
  });
}

/**
 * Returns all active subjects applicable to a specific class.
 */
export function getApplicableSubjectsForClass(
  subjects: SubjectItem[],
  className: string,
  classes?: ClassItem[]
): SubjectItem[] {
  return (subjects || []).filter(sub => isSubjectApplicableToClass(sub, className, classes));
}

/**
 * Returns formatted human-readable list of classes a subject is linked to.
 */
export function getSubjectClassAssignmentSummary(
  subject: SubjectItem,
  allClasses: ClassItem[]
): { isAll: boolean; count: number; label: string; classNames: string[] } {
  if (!subject.applicableClasses || subject.applicableClasses.length === 0 || subject.applicableClasses.includes('ALL')) {
    return {
      isAll: true,
      count: allClasses.length,
      label: 'All Classes',
      classNames: allClasses.map(c => c.name),
    };
  }

  const resolvedNames: string[] = [];
  subject.applicableClasses.forEach(app => {
    const match = allClasses.find(c => c.name.toLowerCase() === app.toLowerCase() || c.id === app);
    if (match) {
      if (!resolvedNames.includes(match.name)) resolvedNames.push(match.name);
    } else {
      if (!resolvedNames.includes(app)) resolvedNames.push(app);
    }
  });

  if (resolvedNames.length >= allClasses.length && allClasses.length > 0) {
    return {
      isAll: true,
      count: allClasses.length,
      label: 'All Classes',
      classNames: resolvedNames,
    };
  }

  return {
    isAll: false,
    count: resolvedNames.length,
    label: resolvedNames.length === 1 ? resolvedNames[0] : `${resolvedNames.length} Classes`,
    classNames: resolvedNames,
  };
}
