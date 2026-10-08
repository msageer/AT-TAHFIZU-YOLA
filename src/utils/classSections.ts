import { ClassItem, SectionItem, AppDatabase } from '../types';

/**
 * Returns the configured arms/sections for a given class.
 * "For class that do not have A or B mean is just the class with no section"
 * - If a class has both Arms A and B (e.g. ['A', 'B']), returns them.
 * - If a class does not have A and B (e.g. empty [], ['A'], or not configured), returns [] (no section).
 */
export function getClassSections(
  cls: ClassItem | undefined,
  globalSections: SectionItem[] = []
): string[] {
  if (!cls) return [];
  if (cls.sections !== undefined && Array.isArray(cls.sections)) {
    // A class must have both 'A' and 'B' arms to be divided into sections.
    // Otherwise, it is just the class with no section.
    const hasA = cls.sections.includes('A');
    const hasB = cls.sections.includes('B');
    if (hasA && hasB) {
      return cls.sections;
    }
    return [];
  }
  // Default for classes without explicit sections: check if name is Primary (with A&B)
  const nameLower = cls.name.toLowerCase();
  if (nameLower.includes('primary') && !nameLower.includes('nursery')) {
    return ['A', 'B'];
  }
  return [];
}

/**
 * Looks up a class by name or id and returns its applicable sections (empty [] if no section).
 */
export function getSectionsForClass(
  className: string,
  classes: ClassItem[] = [],
  globalSections: SectionItem[] = []
): string[] {
  if (!className) return [];
  const matchedClass = classes.find(
    c =>
      c.name.toLowerCase().trim() === className.toLowerCase().trim() ||
      c.id === className
  );
  return getClassSections(matchedClass, globalSections);
}

/**
 * Returns true if the class has configured arms/sections (e.g. A and B).
 * Returns false if the class has NO section (single stream).
 */
export function hasClassSections(
  className: string,
  classes: ClassItem[] = [],
  globalSections: SectionItem[] = []
): boolean {
  const sections = getSectionsForClass(className, classes, globalSections);
  return sections.length > 0;
}

/**
 * Formats a student's class and section.
 * If the class has NO section (i.e. no A or B), returns just the class name (e.g. "Nursery One").
 * If the class has sections, returns "Primary One (Section A)" or "Primary One (A)".
 */
export function formatClassWithSection(
  className: string,
  section?: string,
  classes: ClassItem[] = []
): string {
  if (!className) return '';
  const hasSections = hasClassSections(className, classes);
  if (!hasSections || !section || section === '-' || section.toLowerCase() === 'none' || section.trim() === '') {
    return className;
  }
  return `${className} (${section})`;
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
  newOrder?: number,
  newFees?: string,
  newTeacher?: string,
  newTermFees?: Record<string, string>
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
        ...(newFees !== undefined ? { nextTermFees: newFees } : {}),
        ...(newTeacher !== undefined ? { classTeacherName: newTeacher } : {}),
        ...(newTermFees !== undefined ? { termFees: newTermFees } : {}),
      };
    }
    return c;
  });

  // Determine if class has sections under new configuration
  const hasValidArms =
    newSections !== undefined
      ? newSections.includes('A') && newSections.includes('B')
      : true;

  // 2. Cascade to students
  const updatedStudents = db.students.map(s => {
    if (s.className.toLowerCase().trim() === oldTrimmed.toLowerCase()) {
      let nextSection = s.section;
      if (newSections !== undefined) {
        if (!hasValidArms) {
          nextSection = '';
        } else if (!newSections.includes(s.section)) {
          nextSection = newSections[0] || 'A';
        }
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
      if (newSections !== undefined) {
        if (!hasValidArms) {
          nextSection = '';
        } else if (!newSections.includes(a.section)) {
          nextSection = newSections[0] || 'A';
        }
      }
      return {
        ...a,
        className: newTrimmed,
        section: nextSection,
        ...(newFees ? { nextTermFees: newFees } : {}),
        ...(newTeacher ? { formTeacherName: newTeacher } : {}),
      };
    }
    return a;
  });

  // 4. Cascade to attendance
  const updatedAttendance = (db.attendance || []).map(att => {
    if (att.className.toLowerCase().trim() === oldTrimmed.toLowerCase()) {
      let nextSection = att.section;
      if (newSections !== undefined) {
        if (!hasValidArms) {
          nextSection = '';
        } else if (!newSections.includes(att.section)) {
          nextSection = newSections[0] || 'A';
        }
      }
      return {
        ...att,
        className: newTrimmed,
        section: nextSection,
      };
    }
    return att;
  });

  // 5. Cascade to subjects applicableClasses and classTeachers
  const updatedSubjects = (db.subjects || []).map(sub => {
    let updatedApplicable = sub.applicableClasses;
    if (sub.applicableClasses && sub.applicableClasses.length > 0 && !sub.applicableClasses.includes('ALL')) {
      updatedApplicable = sub.applicableClasses.map(ac => {
        if (ac.toLowerCase().trim() === oldTrimmed.toLowerCase()) {
          return newTrimmed;
        }
        return ac;
      });
    }

    const updatedClassTeachers = sub.classTeachers ? { ...sub.classTeachers } : undefined;
    if (updatedClassTeachers && updatedClassTeachers[oldTrimmed]) {
      updatedClassTeachers[newTrimmed] = updatedClassTeachers[oldTrimmed];
      delete updatedClassTeachers[oldTrimmed];
    }

    return {
      ...sub,
      applicableClasses: updatedApplicable,
      ...(updatedClassTeachers ? { classTeachers: updatedClassTeachers } : {}),
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

  // 7. Cascade to school settings termSettings and classFees
  const updatedSettings = { ...db.settings };
  if (updatedSettings.classFees && updatedSettings.classFees[oldTrimmed]) {
    updatedSettings.classFees = {
      ...updatedSettings.classFees,
      [newTrimmed]: updatedSettings.classFees[oldTrimmed],
    };
    delete updatedSettings.classFees[oldTrimmed];
  }
  if (updatedSettings.termSettings) {
    const updatedTermSettings: Record<string, any> = { ...updatedSettings.termSettings };
    Object.keys(updatedTermSettings).forEach(t => {
      const tc = updatedTermSettings[t];
      if (tc && tc.classFees && tc.classFees[oldTrimmed]) {
        tc.classFees = {
          ...tc.classFees,
          [newTrimmed]: tc.classFees[oldTrimmed],
        };
        delete tc.classFees[oldTrimmed];
      }
    });
    updatedSettings.termSettings = updatedTermSettings;
  }

  return {
    ...db,
    settings: updatedSettings,
    classes: updatedClasses,
    students: updatedStudents,
    assessments: updatedAssessments,
    attendance: updatedAttendance,
    subjects: updatedSubjects,
    users: updatedUsers,
  };
}
