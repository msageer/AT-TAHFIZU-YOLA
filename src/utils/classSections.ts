import { ClassItem, SectionItem, AppDatabase } from '../types';

/**
 * Returns the configured arms/sections for a given class.
 * If the class has specific sections defined, returns them (e.g. ['A'], ['A', 'B'], ['Tahfiz']).
 * Otherwise, falls back to the school's global sections or ['A'].
 */
export function getClassSections(
  cls: ClassItem | undefined,
  globalSections: SectionItem[] = []
): string[] {
  if (cls?.sections && Array.isArray(cls.sections) && cls.sections.length > 0) {
    return cls.sections;
  }
  const globalNames = (globalSections || []).map(s => s.name);
  return globalNames.length > 0 ? globalNames : ['A'];
}

/**
 * Looks up a class by name or id and returns its applicable sections.
 */
export function getSectionsForClass(
  className: string,
  classes: ClassItem[] = [],
  globalSections: SectionItem[] = []
): string[] {
  if (!className) return ['A'];
  const matchedClass = classes.find(
    c =>
      c.name.toLowerCase().trim() === className.toLowerCase().trim() ||
      c.id === className
  );
  return getClassSections(matchedClass, globalSections);
}

/**
 * Cascades a class rename across the entire database to maintain 100% data integrity.
 * Updates:
 * - classes list (renames the class and updates sections if provided)
 * - students (migrates all enrolled students to new class name)
 * - assessments (migrates all assessment records)
 * - attendance (migrates all attendance records)
 * - subjects (updates applicableClasses mappings)
 * - users (updates teacher assignedClass)
 */
export function cascadeRenameClass(
  db: AppDatabase,
  oldClassName: string,
  newClassName: string,
  newSections?: string[],
  newOrder?: number
): AppDatabase {
  const oldTrimmed = oldClassName.trim();
  const newTrimmed = newClassName.trim();

  // 1. Update Classes array
  const updatedClasses = db.classes.map(c => {
    if (c.name.toLowerCase().trim() === oldTrimmed.toLowerCase()) {
      return {
        ...c,
        name: newTrimmed,
        ...(newSections !== undefined ? { sections: newSections } : {}),
        ...(newOrder !== undefined ? { order: newOrder } : {}),
      };
    }
    return c;
  });

  // If class name did not change, but sections/order changed:
  const isRename = oldTrimmed.toLowerCase() !== newTrimmed.toLowerCase();

  // 2. Cascade to students
  const updatedStudents = db.students.map(s => {
    if (s.className.toLowerCase().trim() === oldTrimmed.toLowerCase()) {
      let nextSection = s.section;
      if (newSections && newSections.length > 0 && !newSections.includes(s.section)) {
        nextSection = newSections[0];
      }
      return {
        ...s,
        className: newTrimmed,
        section: nextSection,
      };
    }
    return s;
  });

  // 3. Cascade to assessments
  const updatedAssessments = db.assessments.map(a => {
    if (a.className.toLowerCase().trim() === oldTrimmed.toLowerCase()) {
      let nextSection = a.section;
      if (newSections && newSections.length > 0 && !newSections.includes(a.section)) {
        nextSection = newSections[0];
      }
      return {
        ...a,
        className: newTrimmed,
        section: nextSection,
      };
    }
    return a;
  });

  // 4. Cascade to attendance
  const updatedAttendance = (db.attendance || []).map(att => {
    if (att.className.toLowerCase().trim() === oldTrimmed.toLowerCase()) {
      let nextSection = att.section;
      if (newSections && newSections.length > 0 && !newSections.includes(att.section)) {
        nextSection = newSections[0];
      }
      return {
        ...att,
        className: newTrimmed,
        section: nextSection,
      };
    }
    return att;
  });

  // 5. Cascade to subjects applicableClasses
  const updatedSubjects = (db.subjects || []).map(sub => {
    if (!sub.applicableClasses || sub.applicableClasses.length === 0 || sub.applicableClasses.includes('ALL')) {
      return sub;
    }
    const updatedApplicable = sub.applicableClasses.map(ac => {
      if (ac.toLowerCase().trim() === oldTrimmed.toLowerCase()) {
        return newTrimmed;
      }
      return ac;
    });
    return {
      ...sub,
      applicableClasses: updatedApplicable,
    };
  });

  // 6. Cascade to user teacher assignments
  const updatedUsers = (db.users || []).map(u => {
    if (u.assignedClass && u.assignedClass.toLowerCase().trim() === oldTrimmed.toLowerCase()) {
      return {
        ...u,
        assignedClass: newTrimmed,
      };
    }
    return u;
  });

  return {
    ...db,
    classes: updatedClasses,
    students: updatedStudents,
    assessments: updatedAssessments,
    attendance: updatedAttendance,
    subjects: updatedSubjects,
    users: updatedUsers,
  };
}
