import React, { useState, useRef, useMemo } from 'react';
import {
  SchoolSettings,
  ClassItem,
  SectionItem,
  SubjectItem,
  GradeBoundary,
  PsychomotorItem,
  AppDatabase,
} from '../types';
import { ConfirmModal } from './ConfirmModal';
import {
  Upload,
  Save,
  Plus,
  Trash2,
  RefreshCw,
  Download,
  AlertCircle,
  Building2,
  GraduationCap,
  BookOpen,
  Award,
  Layers,
  HeartHandshake,
  CheckSquare,
  Check,
  CheckCircle2,
  Edit2,
  X,
  Users,
  Calendar,
  Coins,
  UserCheck,
} from 'lucide-react';
import {
  getSubjectClassAssignmentSummary,
  isSubjectApplicableToClass,
} from '../utils/subjectMapping';
import {
  cascadeRenameClass,
  getClassSections,
} from '../utils/classSections';

interface SettingsProps {
  db: AppDatabase;
  onUpdateDb: (updated: AppDatabase) => void;
  onResetDefaults: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ db, onUpdateDb, onResetDefaults }) => {
  const [activeSection, setActiveSection] = useState<
    | 'school'
    | 'classes'
    | 'sections'
    | 'subjects'
    | 'subject-allocation'
    | 'grading'
    | 'psychomotor'
    | 'backup'
  >('school');

  // Allocation view sub-mode
  const [allocationMode, setAllocationMode] = useState<'matrix' | 'by-class' | 'by-subject'>('matrix');
  const [selectedAllocationClass, setSelectedAllocationClass] = useState<string>(
    db.classes[0]?.name || ''
  );
  const [selectedAllocationSubjectId, setSelectedAllocationSubjectId] = useState<string>(
    db.subjects[0]?.id || ''
  );

  // In-App Confirmation Pop-up State
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  } | null>(null);

  // Form states
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>({ ...db.settings });
  const [classes, setClasses] = useState<ClassItem[]>([...db.classes]);
  const [sections, setSections] = useState<SectionItem[]>([...db.sections]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([...db.subjects]);
  const [gradingBoundaries, setGradingBoundaries] = useState<GradeBoundary[]>([
    ...db.gradingBoundaries,
  ]);
  const [psychomotorItems, setPsychomotorItems] = useState<PsychomotorItem[]>([
    ...db.psychomotorItems,
  ]);

  // Term-specific calendar & fees active tab (1st Term, 2nd Term, 3rd Term)
  const [selectedTermSettingsTab, setSelectedTermSettingsTab] = useState<'1st Term' | '2nd Term' | '3rd Term'>(
    (db.settings.currentTerm as any) || '1st Term'
  );

  // Available teachers (from db.users with role teacher or staff, plus any assigned form teachers)
  const availableTeachers = useMemo(() => {
    const list: Array<{ id: string; name: string; role: string; email?: string }> = [];
    const namesSeen = new Set<string>();

    (db.users || []).forEach(u => {
      if (u.fullName && !namesSeen.has(u.fullName.toLowerCase().trim())) {
        namesSeen.add(u.fullName.toLowerCase().trim());
        list.push({ id: u.id, name: u.fullName.trim(), role: u.role, email: u.email });
      }
    });

    (db.classes || []).forEach(c => {
      if (c.classTeacherName && !namesSeen.has(c.classTeacherName.toLowerCase().trim())) {
        namesSeen.add(c.classTeacherName.toLowerCase().trim());
        list.push({ id: `cls-teacher-${c.id}`, name: c.classTeacherName.trim(), role: 'teacher' });
      }
    });

    return list;
  }, [db.users, db.classes]);

  // Current term configuration for selectedTermSettingsTab
  const currentTermCfg = schoolSettings.termSettings?.[selectedTermSettingsTab] || {
    schoolCloses: schoolSettings.schoolCloses || '24th Dhul Hijjah 1447 / 10th June 2026',
    nextTermBegins: schoolSettings.nextTermBegins || '04th Muharram 1448 / 20th July 2026',
    defaultFees: schoolSettings.defaultNextTermFees || '₦ 16,000',
    classFees: { ...(schoolSettings.classFees || {}) },
  };

  const handleUpdateTermField = (field: 'schoolCloses' | 'nextTermBegins' | 'defaultFees', value: string) => {
    const updatedTermCfg = {
      ...currentTermCfg,
      [field]: value,
    };
    const updatedTermSettings = {
      ...(schoolSettings.termSettings || {}),
      [selectedTermSettingsTab]: updatedTermCfg,
    };
    setSchoolSettings(prev => ({
      ...prev,
      termSettings: updatedTermSettings,
      ...(selectedTermSettingsTab === prev.currentTerm ? { [field === 'defaultFees' ? 'defaultNextTermFees' : field]: value } : {}),
    }));
  };

  const handleUpdateTermClassFee = (className: string, feeValue: string) => {
    const updatedClassFees = {
      ...(currentTermCfg.classFees || {}),
      [className]: feeValue,
    };
    const updatedTermCfg = {
      ...currentTermCfg,
      classFees: updatedClassFees,
    };
    const updatedTermSettings = {
      ...(schoolSettings.termSettings || {}),
      [selectedTermSettingsTab]: updatedTermCfg,
    };

    const updatedClasses = classes.map(c => {
      if (c.name.toLowerCase().trim() === className.toLowerCase().trim()) {
        return {
          ...c,
          termFees: {
            ...(c.termFees || {}),
            [selectedTermSettingsTab]: feeValue,
          },
          ...(selectedTermSettingsTab === schoolSettings.currentTerm ? { nextTermFees: feeValue } : {}),
        };
      }
      return c;
    });

    setClasses(updatedClasses);
    setSchoolSettings(prev => ({
      ...prev,
      termSettings: updatedTermSettings,
      ...(selectedTermSettingsTab === prev.currentTerm ? {
        classFees: {
          ...(prev.classFees || {}),
          [className]: feeValue,
        },
      } : {}),
    }));
  };

  const handleCopyTermSettingsToAllTerms = () => {
    const updatedTermSettings: Record<string, any> = { ...(schoolSettings.termSettings || {}) };
    ['1st Term', '2nd Term', '3rd Term'].forEach(t => {
      updatedTermSettings[t] = {
        schoolCloses: currentTermCfg.schoolCloses,
        nextTermBegins: currentTermCfg.nextTermBegins,
        defaultFees: currentTermCfg.defaultFees,
        classFees: { ...(currentTermCfg.classFees || {}) },
      };
    });
    setSchoolSettings(prev => ({
      ...prev,
      termSettings: updatedTermSettings,
    }));
    showNotification(`Dates & Class fees from ${selectedTermSettingsTab} copied to all terms!`);
  };

  const handleApplyDefaultFeeToAllClasses = () => {
    const feeToApply = currentTermCfg.defaultFees || '₦ 16,000';
    const updatedClassFees: Record<string, string> = {};
    classes.forEach(c => {
      updatedClassFees[c.name] = feeToApply;
    });
    const updatedTermCfg = {
      ...currentTermCfg,
      classFees: updatedClassFees,
    };
    const updatedTermSettings = {
      ...(schoolSettings.termSettings || {}),
      [selectedTermSettingsTab]: updatedTermCfg,
    };

    const updatedClasses = classes.map(c => ({
      ...c,
      termFees: {
        ...(c.termFees || {}),
        [selectedTermSettingsTab]: feeToApply,
      },
      ...(selectedTermSettingsTab === schoolSettings.currentTerm ? { nextTermFees: feeToApply } : {}),
    }));

    setClasses(updatedClasses);
    setSchoolSettings(prev => ({
      ...prev,
      termSettings: updatedTermSettings,
      ...(selectedTermSettingsTab === prev.currentTerm ? { classFees: updatedClassFees } : {}),
    }));
    showNotification(`Applied ${feeToApply} to all classes in ${selectedTermSettingsTab}`);
  };

  const handleUpdateClassTeacherDirect = (classId: string, teacherName: string) => {
    const updated = classes.map(c =>
      c.id === classId ? { ...c, classTeacherName: teacherName } : c
    );
    setClasses(updated);
  };

  // Notifications
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Logo upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      showNotification('Please upload a valid image file (PNG, JPG, JPEG, SVG)', 'error');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      showNotification('Image size should be under 3MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setSchoolSettings(prev => ({ ...prev, logoUrl: dataUrl }));
      showNotification('School logo uploaded successfully. Remember to click Save Settings!');
    };
    reader.readAsDataURL(file);
  };

  // Save all settings
  const handleSaveSchoolSettings = () => {
    const caTotal = Number(schoolSettings.ca1Max) + Number(schoolSettings.ca2Max) + Number(schoolSettings.examMax);
    const proceedWithSave = () => {
      const updatedDb: AppDatabase = {
        ...db,
        settings: schoolSettings,
        classes,
        sections,
        subjects,
        gradingBoundaries,
        psychomotorItems,
      };
      onUpdateDb(updatedDb);
      showNotification('School settings updated successfully!');
      setConfirmModalConfig(null);
    };

    if (caTotal !== 100) {
      setConfirmModalConfig({
        isOpen: true,
        title: 'Score Distribution Warning',
        message: `1st CA (${schoolSettings.ca1Max}) + 2nd CA (${schoolSettings.ca2Max}) + Exam (${schoolSettings.examMax}) = ${caTotal}%, which does not equal 100%. Do you still want to proceed?`,
        details: `Calculated total: ${caTotal}% (Recommended: 100%)`,
        variant: 'warning',
        confirmText: 'Yes, Save Anyway',
        onConfirm: proceedWithSave,
      });
      return;
    }

    setConfirmModalConfig({
      isOpen: true,
      title: 'Confirm Save Settings',
      message: `Are you sure you want to save school configuration for "${schoolSettings.schoolName}"?`,
      details: `Academic Session: ${schoolSettings.currentSession} • Term: ${schoolSettings.currentTerm}`,
      variant: 'primary',
      confirmText: 'Yes, Save Settings',
      onConfirm: proceedWithSave,
    });
  };

  // Class management handlers
  const [newClassName, setNewClassName] = useState('');
  const [newClassSections, setNewClassSections] = useState<string[]>([]);
  const [newClassFees, setNewClassFees] = useState('₦ 16,000');
  const [newClassTeacher, setNewClassTeacher] = useState('');

  // Class edit state
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [editClassOrder, setEditClassOrder] = useState<number>(1);
  const [editClassSections, setEditClassSections] = useState<string[]>([]);
  const [editClassFees, setEditClassFees] = useState('₦ 16,000');
  const [editClassTeacher, setEditClassTeacher] = useState('');
  const [editClassTermFees, setEditClassTermFees] = useState<Record<string, string>>({
    '1st Term': '₦ 16,000',
    '2nd Term': '₦ 16,000',
    '3rd Term': '₦ 16,000',
  });
  const [newArmName, setNewArmName] = useState('');

  const handleStartEditClass = (cls: ClassItem) => {
    setEditingClass(cls);
    setEditClassName(cls.name);
    setEditClassOrder(cls.order || 1);
    const configuredSections = cls.sections !== undefined && Array.isArray(cls.sections)
      ? cls.sections
      : getClassSections(cls, sections);
    setEditClassSections(configuredSections);
    setEditClassFees(cls.nextTermFees || schoolSettings.classFees?.[cls.name] || schoolSettings.defaultNextTermFees || '₦ 16,000');
    setEditClassTeacher(cls.classTeacherName || '');
    setEditClassTermFees({
      '1st Term': cls.termFees?.['1st Term'] || schoolSettings.termSettings?.['1st Term']?.classFees?.[cls.name] || cls.nextTermFees || '₦ 16,000',
      '2nd Term': cls.termFees?.['2nd Term'] || schoolSettings.termSettings?.['2nd Term']?.classFees?.[cls.name] || cls.nextTermFees || '₦ 16,000',
      '3rd Term': cls.termFees?.['3rd Term'] || schoolSettings.termSettings?.['3rd Term']?.classFees?.[cls.name] || cls.nextTermFees || '₦ 16,000',
    });
    setNewArmName('');
  };

  const handleToggleEditSection = (secName: string) => {
    if (editClassSections.includes(secName)) {
      setEditClassSections(prev => prev.filter(s => s !== secName));
    } else {
      setEditClassSections(prev => [...prev, secName]);
    }
  };

  const handleAddCustomArmToClass = () => {
    const trimmed = newArmName.trim();
    if (!trimmed) return;
    if (editClassSections.includes(trimmed)) {
      showNotification(`Arm "${trimmed}" already included in this class`, 'error');
      return;
    }
    setEditClassSections(prev => [...prev, trimmed]);
    setNewArmName('');
  };

  const handleSaveEditClass = () => {
    if (!editingClass || !editClassName.trim()) return;
    const oldName = editingClass.name;
    const newName = editClassName.trim();
    // Classes without both A and B are treated as Default (no section)
    const finalSections =
      editClassSections.includes('A') && editClassSections.includes('B')
        ? editClassSections
        : [];

    const enrolledStudents = db.students.filter(
      s => s.className.toLowerCase().trim() === oldName.toLowerCase().trim()
    );

    const proceedSave = () => {
      const updatedDb = cascadeRenameClass(
        db,
        oldName,
        newName,
        finalSections,
        editClassOrder,
        editClassFees.trim() || '₦ 16,000',
        editClassTeacher.trim(),
        editClassTermFees
      );
      // Synchronize class fees into settings.classFees and settings.termSettings
      const updatedClassFees: Record<string, string> = {
        ...(updatedDb.settings.classFees || {}),
        [newName]: editClassFees.trim() || '₦ 16,000',
      };
      if (oldName !== newName && updatedClassFees[oldName]) {
        delete updatedClassFees[oldName];
      }

      const updatedTermSettings: Record<string, any> = { ...(updatedDb.settings.termSettings || {}) };
      ['1st Term', '2nd Term', '3rd Term'].forEach(t => {
        const tc = { ...(updatedTermSettings[t] || {}) };
        const tcClassFees = { ...(tc.classFees || {}) };
        if (editClassTermFees[t]) {
          tcClassFees[newName] = editClassTermFees[t];
        }
        if (oldName !== newName && tcClassFees[oldName]) {
          delete tcClassFees[oldName];
        }
        tc.classFees = tcClassFees;
        updatedTermSettings[t] = tc;
      });

      updatedDb.settings = {
        ...updatedDb.settings,
        classFees: updatedClassFees,
        termSettings: updatedTermSettings,
      };

      setSchoolSettings(updatedDb.settings);
      setClasses(updatedDb.classes);
      onUpdateDb(updatedDb);
      setEditingClass(null);
      showNotification(`Class "${newName}" configuration updated successfully!`);
      setConfirmModalConfig(null);
    };

    if (oldName.toLowerCase().trim() !== newName.toLowerCase().trim()) {
      setConfirmModalConfig({
        isOpen: true,
        title: 'Confirm Class Renaming & Cascade',
        message: `Are you sure you want to rename class "${oldName}" to "${newName}"? All ${enrolledStudents.length} enrolled student records, attendance data, and assessment broadsheets will be updated automatically.`,
        details: `Class: ${oldName} \u2192 ${newName} \u2022 Arms: ${finalSections.length > 0 ? finalSections.join(', ') : 'No Section (Single Stream)'}`,
        variant: 'primary',
        confirmText: 'Yes, Rename & Update All',
        onConfirm: proceedSave,
      });
      return;
    }

    proceedSave();
  };

  const handleAddClass = () => {
    if (!newClassName.trim()) return;
    const exists = classes.some(c => c.name.toLowerCase() === newClassName.trim().toLowerCase());
    if (exists) {
      showNotification(`Class "${newClassName}" already exists`, 'error');
      return;
    }
    const finalSections =
      newClassSections.includes('A') && newClassSections.includes('B')
        ? newClassSections
        : [];

    const newClassFee = newClassFees.trim() || schoolSettings.defaultNextTermFees || '₦ 16,000';
    const newClass: ClassItem = {
      id: `cls-${Date.now()}`,
      name: newClassName.trim(),
      order: classes.length + 1,
      sections: finalSections,
      nextTermFees: newClassFee,
      termFees: {
        '1st Term': schoolSettings.termSettings?.['1st Term']?.defaultFees || newClassFee,
        '2nd Term': schoolSettings.termSettings?.['2nd Term']?.defaultFees || newClassFee,
        '3rd Term': schoolSettings.termSettings?.['3rd Term']?.defaultFees || newClassFee,
        [schoolSettings.currentTerm || '1st Term']: newClassFee,
      },
      classTeacherName: newClassTeacher.trim(),
    };
    const updated = [...classes, newClass];
    setClasses(updated);
    setNewClassName('');
    setNewClassFees('₦ 16,000');
    setNewClassTeacher('');
    setNewClassSections([]);

    const updatedClassFees: Record<string, string> = {
      ...(schoolSettings.classFees || {}),
      [newClass.name]: newClassFee,
    };
    const updatedTermSettings: Record<string, any> = { ...(schoolSettings.termSettings || {}) };
    ['1st Term', '2nd Term', '3rd Term'].forEach(t => {
      const existingTc = updatedTermSettings[t] || {};
      updatedTermSettings[t] = {
        ...existingTc,
        classFees: {
          ...(existingTc.classFees || {}),
          [newClass.name]: newClass.termFees?.[t] || newClassFee,
        },
      };
    });
    const updatedDb: AppDatabase = {
      ...db,
      classes: updated,
      settings: {
        ...schoolSettings,
        classFees: updatedClassFees,
        termSettings: updatedTermSettings,
      },
    };
    setSchoolSettings(updatedDb.settings);
    onUpdateDb(updatedDb);
    showNotification(`Class "${newClass.name}" added successfully!`);
  };

  const handleDeleteClass = (id: string, name: string) => {
    if (classes.length <= 1) {
      showNotification('At least one class is required', 'error');
      return;
    }
    setConfirmModalConfig({
      isOpen: true,
      title: 'Delete Class',
      message: `Are you sure you want to delete class "${name}"? Existing student records will retain their class name.`,
      variant: 'danger',
      confirmText: 'Yes, Delete Class',
      onConfirm: () => {
        const updated = classes.filter(c => c.id !== id);
        setClasses(updated);
        onUpdateDb({ ...db, classes: updated });
        showNotification(`Class "${name}" removed.`);
        setConfirmModalConfig(null);
      },
    });
  };

  // Section management handlers
  const [newSectionName, setNewSectionName] = useState('');
  const handleAddSection = () => {
    if (!newSectionName.trim()) return;
    const exists = sections.some(s => s.name.toLowerCase() === newSectionName.trim().toLowerCase());
    if (exists) {
      showNotification(`Section "${newSectionName}" already exists`, 'error');
      return;
    }
    const newSec: SectionItem = {
      id: `sec-${Date.now()}`,
      name: newSectionName.trim(),
    };
    const updated = [...sections, newSec];
    setSections(updated);
    setNewSectionName('');
    onUpdateDb({ ...db, sections: updated });
    showNotification(`Section "${newSec.name}" added successfully!`);
  };

  const handleDeleteSection = (id: string, name: string) => {
    if (sections.length <= 1) {
      showNotification('At least one section is required', 'error');
      return;
    }
    setConfirmModalConfig({
      isOpen: true,
      title: 'Delete Section',
      message: `Are you sure you want to delete section "${name}"?`,
      variant: 'danger',
      confirmText: 'Yes, Delete Section',
      onConfirm: () => {
        const updated = sections.filter(s => s.id !== id);
        setSections(updated);
        onUpdateDb({ ...db, sections: updated });
        showNotification(`Section "${name}" deleted.`);
        setConfirmModalConfig(null);
      },
    });
  };

  // Subject management handlers
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectArabic, setNewSubjectArabic] = useState('');
  const [newSubjectTeacher, setNewSubjectTeacher] = useState('');
  const handleAddSubject = () => {
    if (!newSubjectName.trim()) return;
    const exists = subjects.some(s => s.name.toLowerCase() === newSubjectName.trim().toLowerCase());
    if (exists) {
      showNotification(`Subject "${newSubjectName}" already exists`, 'error');
      return;
    }
    const newSub: SubjectItem = {
      id: `sub-${Date.now()}`,
      name: newSubjectName.trim(),
      arabicName: newSubjectArabic.trim() || newSubjectName.trim(),
      isActive: true,
      teacherName: newSubjectTeacher.trim() || undefined,
    };
    const updated = [...subjects, newSub];
    setSubjects(updated);
    setNewSubjectName('');
    setNewSubjectArabic('');
    setNewSubjectTeacher('');
    onUpdateDb({ ...db, subjects: updated });
    showNotification(`Subject "${newSub.name}" added successfully!`);
  };

  const handleDeleteSubject = (id: string, name: string) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Delete Subject',
      message: `Are you sure you want to delete subject "${name}"? Past records will remain intact.`,
      variant: 'danger',
      confirmText: 'Yes, Delete Subject',
      onConfirm: () => {
        const updated = subjects.filter(s => s.id !== id);
        setSubjects(updated);
        onUpdateDb({ ...db, subjects: updated });
        showNotification(`Subject "${name}" deleted.`);
        setConfirmModalConfig(null);
      },
    });
  };

  const handleToggleSubject = (id: string) => {
    const updated = subjects.map(s => (s.id === id ? { ...s, isActive: !s.isActive } : s));
    setSubjects(updated);
    onUpdateDb({ ...db, subjects: updated });
  };

  const handleSetSubjectTeacher = (subjectId: string, teacherName: string) => {
    const updated = subjects.map(sub => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        teacherName: teacherName || undefined,
      };
    });
    setSubjects(updated);
    onUpdateDb({ ...db, subjects: updated });
    showNotification(teacherName ? `Teacher "${teacherName}" assigned to subject.` : 'Teacher unassigned.');
  };

  const handleSetSubjectClassTeacher = (subjectId: string, className: string, teacherName: string) => {
    const updated = subjects.map(sub => {
      if (sub.id !== subjectId) return sub;
      const currentMap = { ...(sub.classTeachers || {}) };
      if (teacherName) {
        currentMap[className] = teacherName;
      } else {
        delete currentMap[className];
      }
      return {
        ...sub,
        classTeachers: currentMap,
      };
    });
    setSubjects(updated);
    onUpdateDb({ ...db, subjects: updated });
    showNotification(
      teacherName
        ? `Teacher "${teacherName}" assigned for ${className}.`
        : `Teacher unassigned for ${className}.`
    );
  };

  // Subject-to-Class Allocation handlers
  const handleToggleSubjectClass = (subjectId: string, className: string) => {
    const updated = subjects.map(sub => {
      if (sub.id !== subjectId) return sub;
      let current = sub.applicableClasses;
      if (!current || current.length === 0 || current.includes('ALL')) {
        current = classes.map(c => c.name);
      }
      let nextClasses: string[];
      if (current.includes(className)) {
        nextClasses = current.filter(c => c !== className);
      } else {
        nextClasses = [...current, className];
      }
      if (nextClasses.length >= classes.length && classes.length > 0) {
        nextClasses = ['ALL'];
      }
      return { ...sub, applicableClasses: nextClasses };
    });
    setSubjects(updated);
    onUpdateDb({ ...db, subjects: updated });
  };

  const handleAssignAllClassesToSubject = (subjectId: string) => {
    const updated = subjects.map(s => (s.id === subjectId ? { ...s, applicableClasses: ['ALL'] } : s));
    setSubjects(updated);
    onUpdateDb({ ...db, subjects: updated });
    showNotification('Subject assigned to all classes.');
  };

  const handleClearAllClassesFromSubject = (subjectId: string) => {
    const updated = subjects.map(s => (s.id === subjectId ? { ...s, applicableClasses: [] } : s));
    setSubjects(updated);
    onUpdateDb({ ...db, subjects: updated });
    showNotification('All class links removed for subject.');
  };

  const handleAssignAllSubjectsToClass = (className: string) => {
    const updated = subjects.map(sub => {
      let current = sub.applicableClasses;
      if (!current || current.length === 0 || current.includes('ALL')) return sub;
      if (!current.includes(className)) {
        const next = [...current, className];
        return {
          ...sub,
          applicableClasses: next.length >= classes.length ? ['ALL'] : next,
        };
      }
      return sub;
    });
    setSubjects(updated);
    onUpdateDb({ ...db, subjects: updated });
    showNotification(`All subjects assigned to ${className}.`);
  };

  const handleClearAllSubjectsFromClass = (className: string) => {
    const updated = subjects.map(sub => {
      let current = sub.applicableClasses;
      if (!current || current.length === 0 || current.includes('ALL')) {
        current = classes.map(c => c.name);
      }
      const next = current.filter(c => c !== className);
      return { ...sub, applicableClasses: next };
    });
    setSubjects(updated);
    onUpdateDb({ ...db, subjects: updated });
    showNotification(`All subjects unlinked from ${className}.`);
  };

  // Psychomotor management handlers
  const [newPsychomotorName, setNewPsychomotorName] = useState('');
  const handleAddPsychomotor = () => {
    if (!newPsychomotorName.trim()) return;
    const newPsy: PsychomotorItem = {
      id: `psy-${Date.now()}`,
      name: newPsychomotorName.trim(),
    };
    const updated = [...psychomotorItems, newPsy];
    setPsychomotorItems(updated);
    setNewPsychomotorName('');
    onUpdateDb({ ...db, psychomotorItems: updated });
    showNotification(`Psychomotor item "${newPsy.name}" added!`);
  };

  const handleDeletePsychomotor = (id: string) => {
    const updated = psychomotorItems.filter(p => p.id !== id);
    setPsychomotorItems(updated);
    onUpdateDb({ ...db, psychomotorItems: updated });
  };

  // Export full JSON backup
  const handleExportBackup = () => {
    const nowIso = new Date().toISOString();
    const updatedSettings = { ...schoolSettings, lastBackupAt: nowIso };
    setSchoolSettings(updatedSettings);
    onUpdateDb({ ...db, settings: updatedSettings });

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ ...db, settings: updatedSettings }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `Islamic_School_Assessment_Backup_${new Date().toISOString().split('T')[0]}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotification('System database backup exported successfully!');
  };

  // Restore backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!parsed.settings || !parsed.classes || !parsed.students) {
          throw new Error('Invalid backup file schema');
        }
        onUpdateDb(parsed);
        setSchoolSettings(parsed.settings);
        setClasses(parsed.classes);
        setSections(parsed.sections);
        setSubjects(parsed.subjects);
        setGradingBoundaries(parsed.gradingBoundaries);
        setPsychomotorItems(parsed.psychomotorItems);
        showNotification('Database backup restored successfully!');
      } catch (err) {
        showNotification('Failed to restore backup: Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Settings &amp; School Setup</h2>
          <p className="text-xs text-slate-500">
            Configure school profile, logo, classes, subjects, grading boundaries, and academic sessions.
          </p>
        </div>

        <button
          onClick={handleSaveSchoolSettings}
          className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
        >
          <Save className="w-4 h-4" />
          <span>Save All Settings</span>
        </button>
      </div>

      {/* Notification Toast */}
      {statusMessage && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center space-x-2 ${
            statusMessage.type === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Sub-nav tabs */}
      <div className="flex space-x-1 border-b border-slate-200 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setActiveSection('school')}
          className={`px-3 py-2 font-semibold rounded-t-lg transition flex items-center space-x-1.5 ${
            activeSection === 'school'
              ? 'bg-blue-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>School Profile &amp; Logo</span>
        </button>

        <button
          onClick={() => setActiveSection('classes')}
          className={`px-3 py-2 font-semibold rounded-t-lg transition flex items-center space-x-1.5 ${
            activeSection === 'classes'
              ? 'bg-blue-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>Classes ({classes.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('sections')}
          className={`px-3 py-2 font-semibold rounded-t-lg transition flex items-center space-x-1.5 ${
            activeSection === 'sections'
              ? 'bg-blue-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Sections ({sections.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('subjects')}
          className={`px-3 py-2 font-semibold rounded-t-lg transition flex items-center space-x-1.5 ${
            activeSection === 'subjects'
              ? 'bg-blue-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Subjects ({subjects.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('subject-allocation')}
          className={`px-3 py-2 font-semibold rounded-t-lg transition flex items-center space-x-1.5 ${
            activeSection === 'subject-allocation'
              ? 'bg-blue-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Subject-Class Allocation</span>
        </button>

        <button
          onClick={() => setActiveSection('grading')}
          className={`px-3 py-2 font-semibold rounded-t-lg transition flex items-center space-x-1.5 ${
            activeSection === 'grading'
              ? 'bg-blue-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Grading &amp; Assessment Limits</span>
        </button>

        <button
          onClick={() => setActiveSection('psychomotor')}
          className={`px-3 py-2 font-semibold rounded-t-lg transition flex items-center space-x-1.5 ${
            activeSection === 'psychomotor'
              ? 'bg-blue-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <HeartHandshake className="w-3.5 h-3.5" />
          <span>Psychomotor Items</span>
        </button>

        <button
          onClick={() => setActiveSection('backup')}
          className={`px-3 py-2 font-semibold rounded-t-lg transition flex items-center space-x-1.5 ${
            activeSection === 'backup'
              ? 'bg-blue-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Backup &amp; Reset</span>
        </button>
      </div>

      {/* TAB 1: SCHOOL PROFILE & LOGO */}
      {activeSection === 'school' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Logo Upload Box */}
            <div className="md:col-span-1 border-2 border-dashed border-slate-300 rounded-xl p-5 text-center flex flex-col items-center justify-center bg-slate-50/50">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                School Crest / Logo
              </span>
              <div className="w-28 h-28 bg-white border border-slate-200 rounded-lg p-2 shadow-inner flex items-center justify-center mb-3">
                {schoolSettings.logoUrl ? (
                  <img
                    src={schoolSettings.logoUrl}
                    alt="School Logo"
                    className="max-h-24 max-w-24 object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-400">No logo</span>
                )}
              </div>

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLogoUpload}
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center space-x-1.5 shadow-sm"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload School Logo</span>
              </button>
              <p className="text-[11px] text-slate-500 mt-2">
                Accepts PNG, JPG, JPEG, SVG. Automatically printed on all report cards.
              </p>
            </div>

            {/* School Details */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  School Name (English)
                </label>
                <input
                  type="text"
                  value={schoolSettings.schoolName}
                  onChange={e => setSchoolSettings({ ...schoolSettings, schoolName: e.target.value })}
                  className="w-full text-sm font-semibold border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. AT-TAHFIZU WAL ITQAN ISLAMIYYA, YOLA"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Arabic School Name (الاسم بالعربية)
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={schoolSettings.arabicSchoolName}
                  onChange={e =>
                    setSchoolSettings({ ...schoolSettings, arabicSchoolName: e.target.value })
                  }
                  className="w-full text-base font-amiri font-bold border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="مدرسة التحفيظ والإتقان الإسلامية، يولا"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  School Motto (شعار المدرسة)
                </label>
                <input
                  type="text"
                  value={schoolSettings.motto}
                  onChange={e => setSchoolSettings({ ...schoolSettings, motto: e.target.value })}
                  className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="شعارنا: خيركم من تعلم القرآن وعلمه"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  School Address
                </label>
                <input
                  type="text"
                  value={schoolSettings.address}
                  onChange={e => setSchoolSettings({ ...schoolSettings, address: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Along Bypass Road, beside Bole Street Junction, Lamido Zubairu Way, Yola Town"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Telephone Number(s)
                  </label>
                  <input
                    type="text"
                    value={schoolSettings.telephone}
                    onChange={e => setSchoolSettings({ ...schoolSettings, telephone: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="08033408522, 08058715879"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={schoolSettings.email}
                    onChange={e => setSchoolSettings({ ...schoolSettings, email: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="attahfizul.itqan@gmail.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Current Academic Session
                  </label>
                  <input
                    type="text"
                    value={schoolSettings.currentSession}
                    onChange={e =>
                      setSchoolSettings({ ...schoolSettings, currentSession: e.target.value })
                    }
                    className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="2025/2026"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Current Term
                  </label>
                  <select
                    value={schoolSettings.currentTerm}
                    onChange={e =>
                      setSchoolSettings({ ...schoolSettings, currentTerm: e.target.value })
                    }
                    className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="1st Term">1st Term</option>
                    <option value="2nd Term">2nd Term</option>
                    <option value="3rd Term">3rd Term</option>
                  </select>
                </div>
              </div>

              {/* Report Sheet Information: Leadership & Term Calendar / School Fees */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Report Sheet Leadership &amp; Term Calendar / School Fees
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500">
                  Opening (resumption) dates, closing (vacation) dates, and school fees for each class can differ per term (1st Term, 2nd Term, 3rd Term). Report cards dynamically display the dates and fees matching that specific term.
                </p>

                {/* Head Teacher / Headmaster Name */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800 uppercase">
                      Head Teacher / Headmaster Name (Applies to all reports)
                    </label>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Auto-fetched on Report Sheet
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <select
                      value={schoolSettings.headTeacherName || ''}
                      onChange={e =>
                        setSchoolSettings({ ...schoolSettings, headTeacherName: e.target.value })
                      }
                      className="w-full sm:w-1/2 text-xs font-semibold border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    >
                      <option value="">-- Select from registered staff / leadership --</option>
                      {availableTeachers.map(t => (
                        <option key={t.id} value={t.name}>
                          {t.name} ({t.role.replace('_', ' ')})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={schoolSettings.headTeacherName || ''}
                      onChange={e =>
                        setSchoolSettings({ ...schoolSettings, headTeacherName: e.target.value })
                      }
                      className="w-full sm:w-1/2 text-xs font-semibold border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      placeholder="Or type custom Head Teacher / Headmaster name"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Printed on student report sheets under &quot;HEAD TEACHER / HEADMASTER&quot; alongside signature/stamp line.
                  </span>
                </div>

                {/* Class / Form Teachers Quick Assignment */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <UserCheck className="w-4 h-4 text-blue-600" />
                      <h5 className="text-xs font-bold text-slate-900 uppercase">
                        Class / Form Teachers Quick Assignment
                      </h5>
                    </div>
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Auto-fetched on Report Sheet by Class
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Assign the class form teacher for each class. Report sheets automatically display the assigned teacher&apos;s name and signature line for each student in that class.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {classes.map(cls => (
                      <div key={cls.id} className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{cls.name}</span>
                          <span className="text-[10px] text-slate-400 font-medium">Form Teacher</span>
                        </div>
                        <select
                          value={cls.classTeacherName || ''}
                          onChange={e => handleUpdateClassTeacherDirect(cls.id, e.target.value)}
                          className="w-full text-xs font-semibold border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-blue-500 bg-white"
                        >
                          <option value="">-- Select Teacher --</option>
                          {availableTeachers.map(t => (
                            <option key={t.id} value={t.name}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Term-Specific Switcher & Configuration Box */}
                <div className="border border-blue-200 rounded-xl overflow-hidden shadow-xs bg-white">
                  <div className="bg-blue-50/80 p-3 border-b border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-blue-950 block">
                        Term Dates &amp; Class Fees Configuration
                      </span>
                      <span className="text-[11px] text-blue-800">
                        Opening &amp; closing dates, and each class&apos;s fees are saved separately for each term.
                      </span>
                    </div>

                    {/* Term Selector Pills */}
                    <div className="flex items-center bg-white p-0.5 rounded-lg border border-blue-200">
                      {(['1st Term', '2nd Term', '3rd Term'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSelectedTermSettingsTab(t)}
                          className={`px-3 py-1 rounded text-xs font-bold transition flex items-center space-x-1 ${
                            selectedTermSettingsTab === t
                              ? 'bg-blue-900 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span>{t}</span>
                          {schoolSettings.currentTerm === t && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" title="Current Academic Term" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Term Dates Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                          School Vacation / Closing Date ({selectedTermSettingsTab})
                        </label>
                        <input
                          type="text"
                          value={currentTermCfg.schoolCloses || ''}
                          onChange={e => handleUpdateTermField('schoolCloses', e.target.value)}
                          className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="e.g. 18th December 2025"
                        />
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          Printed under &apos;School closes&apos; on {selectedTermSettingsTab} reports.
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                          Next Term Resumption / Opening Date ({selectedTermSettingsTab})
                        </label>
                        <input
                          type="text"
                          value={currentTermCfg.nextTermBegins || ''}
                          onChange={e => handleUpdateTermField('nextTermBegins', e.target.value)}
                          className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="e.g. 12th January 2026"
                        />
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          Printed under &apos;NEXT TERM BEGINS&apos; on {selectedTermSettingsTab} reports.
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                          Default Fees for {selectedTermSettingsTab}
                        </label>
                        <div className="flex items-center space-x-1.5">
                          <input
                            type="text"
                            value={currentTermCfg.defaultFees || ''}
                            onChange={e => handleUpdateTermField('defaultFees', e.target.value)}
                            className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="e.g. ₦ 16,000"
                          />
                          <button
                            type="button"
                            onClick={handleApplyDefaultFeeToAllClasses}
                            className="whitespace-nowrap px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-300 transition"
                            title={`Set all classes in ${selectedTermSettingsTab} to this fee`}
                          >
                            Set All
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          Fallback fee for {selectedTermSettingsTab}.
                        </span>
                      </div>
                    </div>

                    {/* Per-Class Fees for selected term */}
                    <div className="pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-800 uppercase flex items-center space-x-1.5">
                          <Coins className="w-3.5 h-3.5 text-amber-600" />
                          <span>Class Fees Breakdown for {selectedTermSettingsTab}:</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleCopyTermSettingsToAllTerms}
                          className="text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md border border-blue-200 transition"
                          title="Copy these dates and per-class fees to 1st, 2nd, and 3rd Term"
                        >
                          Copy {selectedTermSettingsTab} to All Terms &rarr;
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                        {classes.map(c => {
                          const feeForThisClass =
                            currentTermCfg.classFees?.[c.name] ||
                            c.termFees?.[selectedTermSettingsTab] ||
                            c.nextTermFees ||
                            currentTermCfg.defaultFees ||
                            '₦ 16,000';

                          return (
                            <div
                              key={c.id}
                              className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex flex-col justify-between space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900 text-xs">{c.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {c.sections?.length ? `Arms ${c.sections.join(',')}` : 'Default'}
                                </span>
                              </div>
                              <input
                                type="text"
                                value={feeForThisClass}
                                onChange={e => handleUpdateTermClassFee(c.name, e.target.value)}
                                className="w-full text-xs font-bold border border-slate-300 rounded px-2 py-1 bg-white text-emerald-900 focus:ring-1 focus:ring-blue-500"
                                placeholder="e.g. ₦ 16,000"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLASSES */}
      {activeSection === 'classes' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Manage School Classes</h3>
                <p className="text-xs text-slate-500">
                  Configure classes, section arms (Default / No Section vs Arms A &amp; B), school fees, and assigned form teachers.
                </p>
              </div>
            </div>

            {/* Quick Add Class Ribbon */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 pt-2 border-t border-slate-200/80 items-end">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Class Name
                </label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                  placeholder="e.g. Primary Three"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 bg-white"
                  onKeyDown={e => e.key === 'Enter' && handleAddClass()}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Arms / Section Stream
                </label>
                <div className="flex items-center space-x-1 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setNewClassSections([])}
                    className={`flex-1 py-1 text-[11px] font-bold rounded transition ${
                      newClassSections.length === 0
                        ? 'bg-blue-900 text-white shadow-2xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                    title="Default: class with no section"
                  >
                    Default (No Section)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewClassSections(['A', 'B'])}
                    className={`flex-1 py-1 text-[11px] font-bold rounded transition ${
                      newClassSections.includes('A') && newClassSections.includes('B')
                        ? 'bg-blue-900 text-white shadow-2xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                    title="Divided into Arms A and B"
                  >
                    Arms A &amp; B
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  School Fees (Next Term)
                </label>
                <input
                  type="text"
                  value={newClassFees}
                  onChange={e => setNewClassFees(e.target.value)}
                  placeholder="e.g. ₦ 16,000"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Form Teacher
                </label>
                <select
                  value={newClassTeacher}
                  onChange={e => setNewClassTeacher(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="">-- Select Added Teacher --</option>
                  {availableTeachers.map(t => (
                    <option key={t.id} value={t.name}>
                      {t.name} ({t.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleAddClass}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition flex items-center justify-center space-x-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Class</span>
                </button>
              </div>
            </div>
          </div>

          {/* Class Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {classes.map((cls, idx) => {
              const classArms = getClassSections(cls, sections);
              const enrolledCount = db.students.filter(
                s => s.className.toLowerCase().trim() === cls.name.toLowerCase().trim()
              ).length;
              const feeAmount = cls.nextTermFees || schoolSettings.classFees?.[cls.name] || schoolSettings.defaultNextTermFees || '₦ 16,000';
              const teacherName = cls.classTeacherName || 'Not assigned';

              return (
                <div
                  key={cls.id}
                  className="flex flex-col justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition space-y-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-6 h-6 rounded bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-slate-200">
                        {cls.order || idx + 1}
                      </span>
                      <div>
                        <span className="text-sm font-bold text-slate-900 block leading-tight">
                          {cls.name}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {enrolledCount} enrolled student{enrolledCount === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => handleStartEditClass(cls)}
                        className="px-2 py-1 text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg text-[11px] font-bold transition flex items-center space-x-1 border border-blue-200 shadow-2xs"
                        title="Edit class name, order, arms, fees, and teacher"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClass(cls.id, cls.name)}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition"
                        title="Delete class"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Class Metadata: Arms, School Fees & Teacher */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                    {/* Arms Status */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Stream:</span>
                      {classArms.length === 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                          Default (No Section)
                        </span>
                      ) : (
                        <div className="flex items-center space-x-1">
                          {classArms.map(secName => (
                            <span
                              key={secName}
                              className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 text-[10px] font-bold border border-blue-200"
                            >
                              Section {secName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* School Fees with Per-Term Breakdown */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center space-x-1">
                          <Coins className="w-3 h-3 text-amber-600" />
                          <span>Term Fees:</span>
                        </span>
                        <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                          {cls.termFees?.[schoolSettings.currentTerm] || feeAmount} <span className="text-[9px] font-normal text-slate-500">({schoolSettings.currentTerm})</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 pt-0.5 text-[10px]">
                        {(['1st Term', '2nd Term', '3rd Term'] as const).map(t => {
                          const tFee = cls.termFees?.[t] || schoolSettings.termSettings?.[t]?.classFees?.[cls.name] || feeAmount;
                          return (
                            <div key={t} className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-center">
                              <span className="text-slate-400 block text-[9px] font-bold uppercase">{t.split(' ')[0]}</span>
                              <span className="font-bold text-slate-700 text-[10px]">{tFee}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Form Teacher */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center space-x-1">
                        <UserCheck className="w-3 h-3 text-slate-500" />
                        <span>Teacher:</span>
                      </span>
                      <span className="font-medium text-slate-700 truncate max-w-[140px] text-[11px]" title={teacherName}>
                        {teacherName}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Per-Class Fees & Assigned Teachers Overview Table */}
          <div className="pt-4 border-t border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Summary: Class Arms, Per-Term Fees (1st, 2nd, 3rd Term) &amp; Form Teachers
                </h4>
                <p className="text-[11px] text-slate-500">
                  Each term has its own specific fees, vacation date, and resumption date which print accurately on student reports.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 w-10">#</th>
                    <th className="py-2.5 px-3">Class Name</th>
                    <th className="py-2.5 px-3">Section Stream</th>
                    <th className="py-2.5 px-3">1st Term Fee</th>
                    <th className="py-2.5 px-3">2nd Term Fee</th>
                    <th className="py-2.5 px-3">3rd Term Fee</th>
                    <th className="py-2.5 px-3">Form Teacher</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classes.map((c, idx) => {
                    const arms = getClassSections(c, sections);
                    const fee1 = c.termFees?.['1st Term'] || schoolSettings.termSettings?.['1st Term']?.classFees?.[c.name] || c.nextTermFees || '₦ 16,000';
                    const fee2 = c.termFees?.['2nd Term'] || schoolSettings.termSettings?.['2nd Term']?.classFees?.[c.name] || c.nextTermFees || '₦ 16,000';
                    const fee3 = c.termFees?.['3rd Term'] || schoolSettings.termSettings?.['3rd Term']?.classFees?.[c.name] || c.nextTermFees || '₦ 16,000';
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 text-slate-400 font-mono">{c.order || idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{c.name}</td>
                        <td className="py-2.5 px-3">
                          {arms.length === 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200">
                              Default (No Section)
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-bold text-[10px] border border-blue-200">
                              Arms {arms.join(', ')}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-800">{fee1}</td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-800">{fee2}</td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-800">{fee3}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">{c.classTeacherName || '-'}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleStartEditClass(c)}
                            className="text-xs text-blue-700 hover:text-blue-900 font-bold hover:underline"
                          >
                            Edit Class
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* EDIT CLASS MODAL */}
          {editingClass && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-blue-50 text-blue-800 rounded-lg">
                      <Edit2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Edit Class Configuration
                      </h3>
                      <p className="text-xs text-slate-500">
                        Customize class name, display order, and specific arms/sections.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingClass(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Class Name *
                    </label>
                    <input
                      type="text"
                      value={editClassName}
                      onChange={e => setEditClassName(e.target.value)}
                      className="w-full text-sm font-semibold border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="e.g. Primary One"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      If renamed, all enrolled students and assessment records will update automatically.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Class Sort Order
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editClassOrder}
                      onChange={e => setEditClassOrder(Number(e.target.value) || 1)}
                      className="w-24 text-sm font-bold border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700 uppercase">
                        Arms &amp; Sections for this Class *
                      </label>
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setEditClassSections([])}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold transition"
                        >
                          No Section (Just Class)
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditClassSections(['A', 'B'])}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold transition"
                        >
                          Arms A &amp; B
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Not all classes have both A and B. Select only the sections applicable to {editClassName || 'this class'}.
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {sections.map(sec => {
                        const isChecked = editClassSections.includes(sec.name);
                        return (
                          <button
                            key={sec.id}
                            type="button"
                            onClick={() => handleToggleEditSection(sec.name)}
                            className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-between transition ${
                              isChecked
                                ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-2xs'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <span>Section {sec.name}</span>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="w-3.5 h-3.5 text-blue-600 rounded pointer-events-none"
                            />
                          </button>
                        );
                      })}
                    </div>

                    {/* Add Custom Arm input for specialized streams (Tahfiz, Islamiyya, etc.) */}
                    <div className="mt-3 flex items-center space-x-2">
                      <input
                        type="text"
                        value={newArmName}
                        onChange={e => setNewArmName(e.target.value)}
                        placeholder="Add custom arm, e.g. Tahfiz"
                        className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 flex-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCustomArmToClass())}
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomArmToClass}
                        className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                      >
                        Add Arm
                      </button>
                    </div>
                  </div>

                  {/* Assigned Teacher & Next Term School Fees for this class */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Assigned Form / Class Teacher
                      </label>
                      <div className="flex items-center space-x-2">
                        <select
                          value={editClassTeacher}
                          onChange={e => setEditClassTeacher(e.target.value)}
                          className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                        >
                          <option value="">-- Select from added teachers --</option>
                          {availableTeachers.map(t => (
                            <option key={t.id} value={t.name}>
                              {t.name} ({t.role})
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={editClassTeacher}
                          onChange={e => setEditClassTeacher(e.target.value)}
                          placeholder="Or type custom name"
                          className="w-48 text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Appears on this class&apos;s report cards under &apos;FORM TEACHER&apos;S NAME&apos;.
                      </span>
                    </div>

                    {/* Per-Term Fees Breakdown */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        School Fees by Term (Each term can have a different fee)
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['1st Term', '2nd Term', '3rd Term'] as const).map(t => (
                          <div key={t} className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <span className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                              {t} Fee:
                            </span>
                            <input
                              type="text"
                              value={editClassTermFees[t] || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setEditClassTermFees(prev => ({ ...prev, [t]: val }));
                                if (t === schoolSettings.currentTerm) {
                                  setEditClassFees(val);
                                }
                              }}
                              placeholder="e.g. ₦ 16,000"
                              className="w-full text-xs font-bold border border-slate-300 rounded p-1.5 bg-white text-emerald-900 focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Report cards automatically show the fee corresponding to that term.
                      </span>
                    </div>
                  </div>

                  {/* Data Preservation Warning */}
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-900 text-xs flex items-center space-x-2">
                    <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span>
                      <strong>Safe Edit:</strong> Updating this class will automatically keep all{' '}
                      <strong>
                        {
                          db.students.filter(
                            s => s.className.toLowerCase().trim() === editingClass.name.toLowerCase().trim()
                          ).length
                        }
                      </strong>{' '}
                      student profiles, marks, and broadsheets synchronized.
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingClass(null)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold text-xs rounded-lg hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditClass}
                    className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center space-x-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Class Changes</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SECTIONS */}
      {activeSection === 'sections' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Manage Class Sections</h3>
              <p className="text-xs text-slate-500">
                Configure arms/sections e.g. A, B, C, Islamiyya, Arabic, Tahfiz.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newSectionName}
                onChange={e => setNewSectionName(e.target.value)}
                placeholder="New section, e.g. Tahfiz"
                className="text-xs border border-slate-300 rounded-lg px-3 py-2 w-48 sm:w-60 focus:outline-none focus:ring-1 focus:ring-blue-500"
                onKeyDown={e => e.key === 'Enter' && handleAddSection()}
              />
              <button
                onClick={handleAddSection}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Section</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
            {sections.map(sec => (
              <div
                key={sec.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-white transition"
              >
                <span className="text-sm font-semibold text-slate-900">{sec.name}</span>
                <button
                  onClick={() => handleDeleteSection(sec.id, sec.name)}
                  className="text-slate-400 hover:text-red-600 p-1 transition"
                  title="Delete section"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: SUBJECTS */}
      {activeSection === 'subjects' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Manage School Subjects</h3>
              <p className="text-xs text-slate-500">
                Configure subjects with their authentic Arabic and English titles.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newSubjectName}
                onChange={e => setNewSubjectName(e.target.value)}
                placeholder="English Name (e.g. Hadith)"
                className="text-xs border border-slate-300 rounded-lg px-3 py-2 w-36 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="text"
                dir="rtl"
                value={newSubjectArabic}
                onChange={e => setNewSubjectArabic(e.target.value)}
                placeholder="Arabic Name (e.g. الحديث)"
                className="text-xs border border-slate-300 rounded-lg px-3 py-2 w-36 font-amiri focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <select
                value={newSubjectTeacher}
                onChange={e => setNewSubjectTeacher(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-3 py-2 w-44 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Assign Teacher --</option>
                {availableTeachers.map(t => (
                  <option key={t.id} value={t.name}>
                    {t.name} ({t.role})
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddSubject}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Subject</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto pt-2">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Subject Name (English)</th>
                  <th className="py-2.5 px-3 text-right">Arabic Name (المادة)</th>
                  <th className="py-2.5 px-3">Subject Teacher</th>
                  <th className="py-2.5 px-3">Assigned Classes</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.map((sub, idx) => {
                  const classSummary = getSubjectClassAssignmentSummary(sub, classes);
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{sub.name}</td>
                      <td className="py-2.5 px-3 font-amiri font-bold text-sm text-right text-slate-900">
                        {sub.arabicName}
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={sub.teacherName || ''}
                          onChange={e => handleSetSubjectTeacher(sub.id, e.target.value)}
                          className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-blue-500 max-w-[170px]"
                        >
                          <option value="">-- Unassigned --</option>
                          {availableTeachers.map(t => (
                            <option key={t.id} value={t.name}>
                              {t.name} ({t.role})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAllocationSubjectId(sub.id);
                            setAllocationMode('by-subject');
                            setActiveSection('subject-allocation');
                          }}
                          className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border transition ${
                            classSummary.isAll
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : classSummary.count === 0
                              ? 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
                              : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                          }`}
                          title={`Assigned to: ${classSummary.classNames.join(', ')}. Click to configure in Subject-Class Allocation.`}
                        >
                          <CheckSquare className="w-3 h-3 flex-shrink-0" />
                          <span>{classSummary.label}</span>
                          <span className="text-[9px] opacity-75 underline ml-1">Edit</span>
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleToggleSubject(sub.id)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                            sub.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {sub.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleDeleteSubject(sub.id, sub.name)}
                          className="text-slate-400 hover:text-red-600 transition p-1"
                          title="Delete subject"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: SUBJECT-TO-CLASS ALLOCATION CONFIGURATION */}
      {activeSection === 'subject-allocation' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-6">
          {/* Header & Sub-Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-900 border border-blue-200">
                  <CheckSquare className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Subject-to-Class Allocation Interface
                  </h3>
                  <p className="text-xs text-slate-500">
                    Link specific subjects to specific classes. The assessment entry form automatically filters out inapplicable subjects per class.
                  </p>
                </div>
              </div>
            </div>

            {/* View Switcher Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex items-center space-x-1 text-xs">
                <button
                  type="button"
                  onClick={() => setAllocationMode('matrix')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition ${
                    allocationMode === 'matrix'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Matrix Grid
                </button>
                <button
                  type="button"
                  onClick={() => setAllocationMode('by-class')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition ${
                    allocationMode === 'by-class'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Class
                </button>
                <button
                  type="button"
                  onClick={() => setAllocationMode('by-subject')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition ${
                    allocationMode === 'by-subject'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Subject
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setConfirmModalConfig({
                    isOpen: true,
                    title: 'Confirm Subject Allocation Save',
                    message:
                      'Are you sure you want to proceed and save these subject allocations across all classes? Assessment entry forms will immediately reflect this mapping.',
                    details: `Total Classes: ${classes.length} • Total Subjects: ${subjects.length}`,
                    variant: 'primary',
                    confirmText: 'Yes, Save Allocation',
                    onConfirm: () => {
                      onUpdateDb({ ...db, subjects });
                      showNotification('Subject-to-class allocations saved successfully!');
                      setConfirmModalConfig(null);
                    },
                  });
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Allocation</span>
              </button>
            </div>
          </div>

          {/* MODE 1: MATRIX VIEW (GRID) */}
          {allocationMode === 'matrix' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2 bg-blue-50/60 p-3 rounded-lg border border-blue-100">
                <span className="text-slate-700">
                  <strong>Matrix Instruction:</strong> Check or uncheck a cell to assign or unassign a subject for that specific class. Changes update in real-time.
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = subjects.map(s => ({ ...s, applicableClasses: ['ALL'] }));
                      setSubjects(updated);
                      onUpdateDb({ ...db, subjects: updated });
                      showNotification('All subjects assigned to all classes.');
                    }}
                    className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 rounded text-slate-700 text-[11px] font-medium"
                  >
                    Select All in School
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold uppercase text-[11px] divide-x divide-slate-200">
                    <tr>
                      <th className="py-3 px-3 w-48 bg-slate-100 sticky left-0 z-10">Subject (English &amp; Arabic)</th>
                      <th className="py-3 px-3 min-w-[170px] bg-slate-100">Subject Teacher (Lead)</th>
                      <th className="py-3 px-2 text-center w-24">Row Action</th>
                      {classes.map(cls => {
                        const countAssigned = subjects.filter(s =>
                          isSubjectApplicableToClass(s, cls.name, classes)
                        ).length;
                        return (
                          <th key={cls.id} className="py-2.5 px-3 text-center min-w-[130px]">
                            <div className="font-bold text-slate-900">{cls.name}</div>
                            <div className="text-[10px] text-slate-500 font-normal">
                              {countAssigned} / {subjects.length} assigned
                            </div>
                            <div className="flex items-center justify-center space-x-1 mt-1 text-[10px]">
                              <button
                                type="button"
                                onClick={() => handleAssignAllSubjectsToClass(cls.name)}
                                className="text-blue-700 hover:underline px-1 py-0.5 rounded hover:bg-white"
                                title={`Assign all subjects to ${cls.name}`}
                              >
                                All
                              </button>
                              <span className="text-slate-300">|</span>
                              <button
                                type="button"
                                onClick={() => handleClearAllSubjectsFromClass(cls.name)}
                                className="text-slate-500 hover:text-red-600 hover:underline px-1 py-0.5 rounded hover:bg-white"
                                title={`Unlink all subjects from ${cls.name}`}
                              >
                                Clear
                              </button>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {subjects.map((sub, sIdx) => (
                      <tr key={sub.id} className="hover:bg-slate-50/70 divide-x divide-slate-100">
                        <td className="py-2.5 px-3 sticky left-0 z-10 bg-white shadow-xs">
                          <div className="font-semibold text-slate-900">{sub.name}</div>
                          <div className="text-[11px] text-slate-500 font-amiri font-bold">
                            {sub.arabicName}
                          </div>
                        </td>
                        <td className="py-2 px-3 bg-white">
                          <select
                            value={sub.teacherName || ''}
                            onChange={e => handleSetSubjectTeacher(sub.id, e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">-- No Teacher --</option>
                            {availableTeachers.map(t => (
                              <option key={t.id} value={t.name}>
                                {t.name} ({t.role})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center space-x-1 text-[10px]">
                            <button
                              type="button"
                              onClick={() => handleAssignAllClassesToSubject(sub.id)}
                              className="text-blue-700 hover:underline px-1 py-0.5 rounded hover:bg-slate-100"
                              title="Assign to all classes"
                            >
                              All
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => handleClearAllClassesFromSubject(sub.id)}
                              className="text-slate-500 hover:text-red-600 hover:underline px-1 py-0.5 rounded hover:bg-slate-100"
                              title="Clear all classes"
                            >
                              Clear
                            </button>
                          </div>
                        </td>
                        {classes.map(cls => {
                          const isAssigned = isSubjectApplicableToClass(sub, cls.name, classes);
                          return (
                            <td
                              key={cls.id}
                              onClick={() => handleToggleSubjectClass(sub.id, cls.name)}
                              className={`py-2.5 px-3 text-center cursor-pointer transition select-none ${
                                isAssigned
                                  ? 'bg-emerald-50/50 hover:bg-emerald-100/70 text-emerald-900'
                                  : 'hover:bg-slate-100 text-slate-400'
                              }`}
                              title={`Click to ${isAssigned ? 'unassign' : 'assign'} "${sub.name}" for "${cls.name}"`}
                            >
                              <div className="flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={isAssigned}
                                  onChange={() => {}} // Handled by td onClick
                                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer pointer-events-none"
                                />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODE 2: BY CLASS ALLOCATION */}
          {allocationMode === 'by-class' && (
            <div className="space-y-4">
              {/* Class Selector Bar */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase">Select Target Class:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {classes.map(cls => (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => setSelectedAllocationClass(cls.name)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        selectedAllocationClass === cls.name
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {cls.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Class Summary Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
                <div className="flex items-center space-x-2 text-emerald-950 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    Curriculum for <strong>{selectedAllocationClass}</strong>:{' '}
                    <strong>
                      {
                        subjects.filter(s =>
                          isSubjectApplicableToClass(s, selectedAllocationClass, classes)
                        ).length
                      }
                    </strong>{' '}
                    of {subjects.length} subjects assigned.
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleAssignAllSubjectsToClass(selectedAllocationClass)}
                    className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100 rounded font-semibold text-xs transition"
                  >
                    Assign All Subjects
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClearAllSubjectsFromClass(selectedAllocationClass)}
                    className="px-2.5 py-1 bg-white border border-red-200 text-red-700 hover:bg-red-50 rounded font-semibold text-xs transition"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Subjects Checklist for Selected Class */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {subjects.map(sub => {
                  const isAssigned = isSubjectApplicableToClass(
                    sub,
                    selectedAllocationClass,
                    classes
                  );
                  const assignedTeacher = sub.classTeachers?.[selectedAllocationClass] || sub.teacherName || '';
                  return (
                    <div
                      key={sub.id}
                      className={`p-3.5 rounded-xl border transition flex flex-col justify-between ${
                        isAssigned
                          ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                          : 'bg-slate-50/70 border-slate-200 hover:bg-white'
                      }`}
                    >
                      <div
                        onClick={() => handleToggleSubjectClass(sub.id, selectedAllocationClass)}
                        className="flex items-center justify-between gap-3 cursor-pointer select-none"
                      >
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{sub.name}</div>
                          <div className="text-xs text-slate-500 font-amiri font-bold">
                            {sub.arabicName}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                              isAssigned
                                ? 'bg-emerald-200/70 text-emerald-900'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {isAssigned ? 'Assigned' : 'Excluded'}
                          </span>
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => {}} // Handled by card onClick
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 pointer-events-none"
                          />
                        </div>
                      </div>

                      {/* Dropdown of added teachers for assigned subject in this class */}
                      {isAssigned && (
                        <div
                          className="mt-3 pt-2.5 border-t border-emerald-200/80 flex items-center justify-between gap-2"
                          onClick={e => e.stopPropagation()}
                        >
                          <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1 whitespace-nowrap">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Teacher:</span>
                          </label>
                          <select
                            value={sub.classTeachers?.[selectedAllocationClass] ?? ''}
                            onChange={e => handleSetSubjectClassTeacher(sub.id, selectedAllocationClass, e.target.value)}
                            className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-blue-500 w-full max-w-[190px]"
                          >
                            <option value="">
                              {sub.teacherName ? `Default (${sub.teacherName})` : '-- Select Teacher --'}
                            </option>
                            {availableTeachers.map(t => (
                              <option key={t.id} value={t.name}>
                                {t.name} ({t.role})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MODE 3: BY SUBJECT ALLOCATION */}
          {allocationMode === 'by-subject' && (
            <div className="space-y-4">
              {/* Subject Selector Bar */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase">Select Target Subject:</span>
                <select
                  value={selectedAllocationSubjectId}
                  onChange={e => setSelectedAllocationSubjectId(e.target.value)}
                  className="text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 min-w-[200px]"
                >
                  {subjects.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} ({sub.arabicName})
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const targetSub = subjects.find(s => s.id === selectedAllocationSubjectId) || subjects[0];
                if (!targetSub) return null;
                const summary = getSubjectClassAssignmentSummary(targetSub, classes);

                return (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-base font-bold text-slate-900">{targetSub.name}</span>
                          <span className="text-sm font-amiri font-bold text-slate-600">
                            {targetSub.arabicName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Currently assigned to: <strong>{summary.label}</strong> ({summary.count} of{' '}
                          {classes.length} classes).
                        </p>

                        <div className="mt-2.5 flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                            <UserCheck className="w-3.5 h-3.5 text-blue-700" />
                            <span>Lead Subject Teacher:</span>
                          </span>
                          <select
                            value={targetSub.teacherName || ''}
                            onChange={e => handleSetSubjectTeacher(targetSub.id, e.target.value)}
                            className="text-xs font-semibold border border-slate-300 rounded-md px-2.5 py-1 bg-white text-slate-800 focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">-- No Default Teacher --</option>
                            {availableTeachers.map(t => (
                              <option key={t.id} value={t.name}>
                                {t.name} ({t.role})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleAssignAllClassesToSubject(targetSub.id)}
                          className="px-3 py-1.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-xs font-semibold transition"
                        >
                          Assign to All Classes
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClearAllClassesFromSubject(targetSub.id)}
                          className="px-3 py-1.5 bg-white border border-red-300 text-red-700 hover:bg-red-50 rounded-lg text-xs font-semibold transition"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {classes.map(cls => {
                        const isAssigned = isSubjectApplicableToClass(targetSub, cls.name, classes);
                        return (
                          <div
                            key={cls.id}
                            className={`p-3 rounded-lg border transition flex flex-col justify-between ${
                              isAssigned
                                ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                                : 'bg-white border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div
                              onClick={() => handleToggleSubjectClass(targetSub.id, cls.name)}
                              className="flex items-center justify-between cursor-pointer select-none"
                            >
                              <span className="text-xs font-bold text-slate-900">{cls.name}</span>
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={() => {}} // Handled by onClick
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 pointer-events-none"
                              />
                            </div>

                            {isAssigned && (
                              <div
                                className="mt-2 pt-2 border-t border-emerald-200/60 flex items-center justify-between gap-1 text-[11px]"
                                onClick={e => e.stopPropagation()}
                              >
                                <span className="text-slate-500 text-[10px] font-semibold">Teacher:</span>
                                <select
                                  value={targetSub.classTeachers?.[cls.name] ?? ''}
                                  onChange={e => handleSetSubjectClassTeacher(targetSub.id, cls.name, e.target.value)}
                                  className="text-[11px] font-semibold border border-slate-300 rounded px-1.5 py-0.5 bg-white text-slate-800 max-w-[130px]"
                                >
                                  <option value="">
                                    {targetSub.teacherName ? `Default (${targetSub.teacherName})` : '-- Select --'}
                                  </option>
                                  {availableTeachers.map(t => (
                                    <option key={t.id} value={t.name}>
                                      {t.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
      {activeSection === 'grading' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-6">
          {/* Assessment Max Limits */}
          <div className="border-b border-slate-200 pb-5">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Cognitive Assessment Score Limits
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Configure the maximum points for 1st Continuous Assessment, 2nd Continuous Assessment, and Term Exam. The total auto-computes to 100%.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  1st C.A Maximum Score
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={schoolSettings.ca1Max}
                    onChange={e =>
                      setSchoolSettings({
                        ...schoolSettings,
                        ca1Max: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full text-base font-bold border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-500">%</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  2nd C.A Maximum Score
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={schoolSettings.ca2Max}
                    onChange={e =>
                      setSchoolSettings({
                        ...schoolSettings,
                        ca2Max: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full text-base font-bold border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-500">%</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Exam Maximum Score
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={schoolSettings.examMax}
                    onChange={e =>
                      setSchoolSettings({
                        ...schoolSettings,
                        examMax: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full text-base font-bold border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-500">%</span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs font-semibold p-2.5 rounded bg-blue-50 text-blue-900 border border-blue-200">
              <span>Combined Total Max:</span>
              <span className="font-bold">
                {Number(schoolSettings.ca1Max) +
                  Number(schoolSettings.ca2Max) +
                  Number(schoolSettings.examMax)}
                %
              </span>
            </div>
          </div>

          {/* Grading Scale Table */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Grading Scale &amp; Remarks</h3>
            <p className="text-xs text-slate-500 mb-4">
              Configured grade details appear on every report sheet and class summary.
            </p>

            <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Score Range</th>
                  <th className="py-2.5 px-3 text-center">Grade Letter</th>
                  <th className="py-2.5 px-3">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gradingBoundaries.map((b, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-semibold">
                      {b.min} &ndash; {b.max}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2.5 py-0.5 rounded font-black bg-slate-900 text-white">
                        {b.grade}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">{b.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: PSYCHOMOTOR ITEMS */}
      {activeSection === 'psychomotor' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Psychomotor / Behavioral Domains</h3>
              <p className="text-xs text-slate-500">
                Traits assessed on the student report card (e.g. Attendance, Punctuality, Neatness, Attentiveness, Honesty, Helping Others, Politeness).
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newPsychomotorName}
                onChange={e => setNewPsychomotorName(e.target.value)}
                placeholder="New trait e.g. Honesty"
                className="text-xs border border-slate-300 rounded-lg px-3 py-2 w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
                onKeyDown={e => e.key === 'Enter' && handleAddPsychomotor()}
              />
              <button
                onClick={handleAddPsychomotor}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-3">
            {psychomotorItems.map(p => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-white transition"
              >
                <span className="text-sm font-semibold text-slate-900">{p.name}</span>
                <button
                  onClick={() => handleDeletePsychomotor(p.id)}
                  className="text-slate-400 hover:text-red-600 p-1 transition"
                  title="Delete item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: BACKUP & RESET */}
      {activeSection === 'backup' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Database Backup, Restore &amp; Data Reset
            </h3>
            <p className="text-xs text-slate-500 mb-2">
              Download complete local backups of all school settings, students, and assessment records, or restore from a previously saved file.
            </p>
            <div className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
              <span>Last Data Backup: </span>
              <strong className="ml-1 text-slate-900">
                {schoolSettings.lastBackupAt
                  ? new Date(schoolSettings.lastBackupAt).toLocaleString()
                  : 'Not backed up yet'}
              </strong>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-800">Export Backup</h4>
              <p className="text-xs text-slate-600">
                Download a complete JSON snapshot of all school records to your computer.
              </p>
              <button
                onClick={handleExportBackup}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold py-2 rounded transition flex items-center justify-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export System Backup</span>
              </button>
            </div>

            <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-800">Restore Backup</h4>
              <p className="text-xs text-slate-600">
                Restore database from an exported JSON file.
              </p>
              <input
                type="file"
                ref={backupInputRef}
                onChange={handleImportBackup}
                accept=".json"
                className="hidden"
              />
              <button
                onClick={() => backupInputRef.current?.click()}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold py-2 rounded transition flex items-center justify-center space-x-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Select Backup File</span>
              </button>
            </div>

            <div className="p-4 border border-red-200 rounded-lg bg-red-50/50 space-y-3">
              <h4 className="text-xs font-bold uppercase text-red-900">Reset to Defaults</h4>
              <p className="text-xs text-red-700">
                Reset everything back to sample data with At-Tahfizul Itqan settings and sample students.
              </p>
              <button
                onClick={() => {
                  setConfirmModalConfig({
                    isOpen: true,
                    title: 'Reset to Sample Data',
                    message: 'Are you sure you want to reset the database to default sample data? This will replace current records with sample school data.',
                    variant: 'danger',
                    confirmText: 'Yes, Reset Database',
                    onConfirm: () => {
                      onResetDefaults();
                      showNotification('Database reset to defaults successfully.');
                      setConfirmModalConfig(null);
                    },
                  });
                }}
                className="w-full bg-red-700 hover:bg-red-800 text-white text-xs font-semibold py-2 rounded transition flex items-center justify-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset to Sample Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Pop-up Modal */}
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
