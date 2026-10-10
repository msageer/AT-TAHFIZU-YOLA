import React, { useState, useEffect } from 'react';
import { Student, AppDatabase, NavigationTab, UserAccount } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { getSectionsForClass, formatClassWithSection } from '../utils/classSections';
import { matchCanonicalClass } from '../utils/excel';
import {
  findDuplicateStudentGroups,
  DeduplicationResult,
  DuplicateStudentGroup,
} from '../utils/studentDeduplication';
import {
  Search,
  Plus,
  UserCheck,
  Edit2,
  Trash2,
  Eye,
  FileText,
  ClipboardPenLine,
  X,
  Phone,
  MapPin,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Lock,
  Hash,
  Sparkles,
  CheckCircle2,
  Copy,
  ListFilter,
  CheckSquare,
} from 'lucide-react';

interface StudentsProps {
  db: AppDatabase;
  currentUser?: UserAccount;
  initialSelectedStudentId?: string | null;
  onClearSelectedStudentId?: () => void;
  onSaveStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  onBatchDeleteStudents?: (studentIds: string[]) => void;
  onAutoCleanDuplicates?: () => DeduplicationResult;
  setActiveTab: (tab: NavigationTab) => void;
  onSelectAssessmentStudent: (studentId: string, className: string, section: string) => void;
  onSelectReportStudent: (studentId: string) => void;
}

export const Students: React.FC<StudentsProps> = ({
  db,
  currentUser,
  initialSelectedStudentId,
  onClearSelectedStudentId,
  onSaveStudent,
  onDeleteStudent,
  onBatchDeleteStudents,
  onAutoCleanDuplicates,
  setActiveTab,
  onSelectAssessmentStudent,
  onSelectReportStudent,
}) => {
  const isTeacher = currentUser?.role === 'teacher';
  const teacherClass = currentUser?.assignedClass;
  const teacherSection = currentUser?.assignedSection;

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState(isTeacher && teacherClass ? teacherClass : 'ALL');
  const [filterSection, setFilterSection] = useState(isTeacher && teacherSection ? teacherSection : 'ALL');
  const [filterGender, setFilterGender] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('Active');

  // Multi-selection state for batch actions
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Selection Numbers Modal & Filter State
  const [isNumberDeleteModalOpen, setIsNumberDeleteModalOpen] = useState(false);
  const [numberInputString, setNumberInputString] = useState('');

  // Duplicate Records Management State
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Jump to student profile when opened via Global Search
  useEffect(() => {
    if (initialSelectedStudentId) {
      const match = db.students.find(
        s =>
          s.id === initialSelectedStudentId ||
          s.studentId.toLowerCase() === initialSelectedStudentId.toLowerCase()
      );
      if (match) {
        setFilterClass(match.className);
        setFilterSection('ALL');
        setSelectedStudentForProfile(match);
      }
    }
  }, [initialSelectedStudentId, db.students]);

  // In-App Confirmation Pop-up State
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  } | null>(null);

  // Form input state
  const [formData, setFormData] = useState<Partial<Student>>({
    studentId: '',
    admissionNumber: '',
    name: '',
    className: isTeacher && teacherClass ? teacherClass : (db.classes[0]?.name || 'Nursery One'),
    section: isTeacher && teacherSection ? teacherSection : (db.sections[0]?.name || 'A'),
    gender: 'Male',
    dateOfBirth: '',
    parentName: '',
    parentPhone: '',
    address: '',
    admissionDate: new Date().toISOString().split('T')[0],
    status: 'Active',
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Filter students
  const filteredStudents = db.students.filter(student => {
    const isClassMatch = (targetClass: string) => {
      if ((student.className || '').toLowerCase().trim() === targetClass.toLowerCase().trim()) return true;
      const { className: canon1 } = matchCanonicalClass(student.className || '', db.classes);
      const { className: canon2 } = matchCanonicalClass(targetClass, db.classes);
      return canon1.toLowerCase().trim() === canon2.toLowerCase().trim();
    };

    // If teacher, strictly enforce their assigned class
    if (isTeacher && teacherClass && !isClassMatch(teacherClass)) return false;
    if (isTeacher && teacherSection && (student.section || '').toUpperCase().trim() !== teacherSection.toUpperCase().trim()) return false;

    // Search query
    const q = searchTerm.toLowerCase().trim();
    if (q) {
      const matchName = student.name?.toLowerCase().includes(q);
      const matchId = student.studentId?.toLowerCase().includes(q);
      const matchAdm = student.admissionNumber?.toLowerCase().includes(q);
      const matchParent = student.parentName?.toLowerCase().includes(q);
      const matchPhone = student.parentPhone?.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchAdm && !matchParent && !matchPhone) return false;
    }

    if (!isTeacher && filterClass !== 'ALL' && !isClassMatch(filterClass)) return false;
    if (!isTeacher && filterSection !== 'ALL') {
      const clsArms = getSectionsForClass(student.className, db.classes, db.sections);
      if (clsArms.length > 0 && (student.section || '').toUpperCase().trim() !== filterSection.toUpperCase().trim()) return false;
    }
    if (filterGender !== 'ALL' && student.gender !== filterGender) return false;
    if (filterStatus !== 'ALL' && student.status !== filterStatus) return false;

    return true;
  });

  // Open add student
  const handleOpenAdd = () => {
    const nextSeq = db.students.length + 1;
    const autoId = `STU-${new Date().getFullYear()}-${String(nextSeq).padStart(3, '0')}`;
    const autoAdm = `ADM/${new Date().getFullYear()}/${String(nextSeq).padStart(3, '0')}`;
    const defaultCls = isTeacher && teacherClass ? teacherClass : (db.classes[0]?.name || 'Nursery One');
    const defaultArms = getSectionsForClass(defaultCls, db.classes, db.sections);
    const defaultSec = isTeacher && teacherSection
      ? teacherSection
      : (defaultArms.length > 0 ? (defaultArms[0] || 'A') : '');

    setEditingStudent(null);
    setFormData({
      studentId: autoId,
      admissionNumber: autoAdm,
      name: '',
      className: defaultCls,
      section: defaultSec,
      gender: 'Male',
      dateOfBirth: '',
      parentName: '',
      parentPhone: '',
      address: '',
      admissionDate: new Date().toISOString().split('T')[0],
      status: 'Active',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  // Open edit student
  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({ ...student });
    setFormError(null);
    setIsFormOpen(true);
  };

  // Submit student form
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name?.trim()) {
      setFormError('Student full name is required');
      return;
    }
    if (!formData.studentId?.trim()) {
      setFormError('Student ID is required');
      return;
    }

    // Check duplicate studentId
    const dupId = db.students.find(
      s =>
        s.studentId.trim().toLowerCase() === formData.studentId?.trim().toLowerCase() &&
        s.id !== editingStudent?.id
    );
    if (dupId) {
      setFormError(`Student ID "${formData.studentId}" is already registered by ${dupId.name}`);
      return;
    }

    // Check duplicate admissionNumber
    if (formData.admissionNumber?.trim()) {
      const dupAdm = db.students.find(
        s =>
          s.admissionNumber.trim().toLowerCase() ===
            formData.admissionNumber?.trim().toLowerCase() && s.id !== editingStudent?.id
      );
      if (dupAdm) {
        setFormError(
          `Admission Number "${formData.admissionNumber}" is already in use by ${dupAdm.name}`
        );
        return;
      }
    }

    const classArms = getSectionsForClass(formData.className || db.classes[0]?.name || 'Nursery One', db.classes, db.sections);
    const studentToSave: Student = {
      id: editingStudent ? editingStudent.id : `stu-${Date.now()}`,
      studentId: formData.studentId!.trim(),
      admissionNumber:
        formData.admissionNumber?.trim() || `ADM-${formData.studentId!.trim()}`,
      name: formData.name!.trim(),
      className: formData.className || db.classes[0]?.name || 'Nursery One',
      section: classArms.length === 0 ? '' : (formData.section || classArms[0] || 'A'),
      gender: formData.gender as 'Male' | 'Female',
      dateOfBirth: formData.dateOfBirth,
      parentName: formData.parentName?.trim(),
      parentPhone: formData.parentPhone?.trim(),
      address: formData.address?.trim(),
      admissionDate: formData.admissionDate,
      status: (formData.status as any) || 'Active',
    };

    if (editingStudent) {
      setConfirmModalConfig({
        isOpen: true,
        title: 'Confirm Student Profile Update',
        message: `Are you sure you want to update the profile details for "${studentToSave.name}"?`,
        details: `Student ID: ${studentToSave.studentId} • Admission: ${studentToSave.admissionNumber} • Class: ${studentToSave.className} (${studentToSave.section})`,
        variant: 'primary',
        confirmText: 'Yes, Save Changes',
        onConfirm: () => {
          onSaveStudent(studentToSave);
          setIsFormOpen(false);
          setConfirmModalConfig(null);
        },
      });
      return;
    }

    // Confirmation pop-up for registering a new student
    setConfirmModalConfig({
      isOpen: true,
      title: 'Confirm New Student Registration',
      message: `Are you sure you want to register new student "${studentToSave.name}" in ${studentToSave.className} (${studentToSave.section})?`,
      details: `Student ID: ${studentToSave.studentId} • Admission No: ${studentToSave.admissionNumber} • Gender: ${studentToSave.gender}`,
      variant: 'primary',
      confirmText: 'Yes, Register Student',
      onConfirm: () => {
        onSaveStudent(studentToSave);
        setIsFormOpen(false);
        setConfirmModalConfig(null);
      },
    });
  };

  // Trigger Delete Confirmation Pop-up Modal
  const handleDeleteClick = (student: Student) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Confirm Student Deletion',
      message: `Are you sure you want to permanently delete the student record for "${student.name}"? This will permanently remove all associated assessment scores and attendance history. Do you want to proceed?`,
      details: `Student: ${student.name} • Class: ${student.className} (${student.section}) • ID: ${student.studentId} • Admission: ${student.admissionNumber}`,
      variant: 'danger',
      confirmText: 'Yes, Delete Student',
      cancelText: 'Cancel',
      onConfirm: () => {
        onDeleteStudent(student.id || student.studentId);
        if (
          selectedStudentForProfile?.id === student.id ||
          selectedStudentForProfile?.studentId === student.studentId
        ) {
          setSelectedStudentForProfile(null);
        }
        setSelectedStudentIds(prev => prev.filter(id => id !== student.id && id !== student.studentId));
        setConfirmModalConfig(null);
      },
    });
  };

  // Trigger Batch Delete Confirmation Pop-up Modal
  const handleBatchDeleteClick = () => {
    if (selectedStudentIds.length === 0) return;
    setConfirmModalConfig({
      isOpen: true,
      title: 'Confirm Batch Student Deletion',
      message: `Are you sure you want to permanently delete ${selectedStudentIds.length} selected student records? This will also remove all their assessment marks and attendance history. Do you want to proceed?`,
      details: `Total selected for deletion: ${selectedStudentIds.length} students`,
      variant: 'danger',
      confirmText: `Yes, Delete ${selectedStudentIds.length} Students`,
      cancelText: 'Cancel',
      onConfirm: () => {
        if (onBatchDeleteStudents) {
          onBatchDeleteStudents(selectedStudentIds);
        } else {
          selectedStudentIds.forEach(id => onDeleteStudent(id));
        }
        if (selectedStudentForProfile && selectedStudentIds.includes(selectedStudentForProfile.id)) {
          setSelectedStudentForProfile(null);
        }
        setSelectedStudentIds([]);
        setConfirmModalConfig(null);
      },
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map(s => s.id));
    }
  };

  const handleToggleSelectStudent = (id: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // ==========================================
  // DUPLICATE STUDENT DETECTION & ACTIONS
  // ==========================================
  const duplicateGroups = findDuplicateStudentGroups(db.students);
  const totalDuplicatesCount = duplicateGroups.reduce(
    (acc, g) => acc + (g.students.length - 1),
    0
  );

  // Selection numbers helper: parse inputs like "1, 3, 5-8, 12" into valid 1-based indices
  const parseSelectionNumbers = (input: string, maxCount: number): number[] => {
    if (!input.trim() || maxCount <= 0) return [];
    const parts = input.split(/[,;\s]+/).map(p => p.trim().replace(/^#/, '')).filter(Boolean);
    const result = new Set<number>();

    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.max(1, Math.min(start, end));
          const max = Math.min(maxCount, Math.max(start, end));
          for (let i = min; i <= max; i++) {
            result.add(i);
          }
        }
      } else {
        const num = parseInt(part, 10);
        if (!isNaN(num) && num >= 1 && num <= maxCount) {
          result.add(num);
        }
      }
    }

    return Array.from(result).sort((a, b) => a - b);
  };

  const parsedSelectionNumbers = parseSelectionNumbers(numberInputString, filteredStudents.length);
  const matchedSelectionStudents = parsedSelectionNumbers
    .map(num => ({
      number: num,
      student: filteredStudents[num - 1],
    }))
    .filter(item => Boolean(item.student));

  const selectedStudentNumbers = filteredStudents
    .map((s, idx) => (selectedStudentIds.includes(s.id) ? idx + 1 : null))
    .filter((n): n is number => n !== null);

  // Apply selection numbers to table checkbox selection
  const handleApplySelectionNumbersToTable = () => {
    const studentIds = matchedSelectionStudents.map(m => m.student.id);
    if (studentIds.length === 0) return;
    setSelectedStudentIds(prev => Array.from(new Set([...prev, ...studentIds])));
    setIsNumberDeleteModalOpen(false);
  };

  // Directly trigger delete for the parsed selection numbers
  const handleDeleteParsedNumbersClick = () => {
    if (matchedSelectionStudents.length === 0) return;
    const targetIds = matchedSelectionStudents.map(m => m.student.id);
    const targetNumbers = matchedSelectionStudents.map(m => `#${m.number}`).join(', ');
    const previewNames = matchedSelectionStudents.slice(0, 5).map(m => m.student.name).join(', ');
    const moreSuffix = matchedSelectionStudents.length > 5 ? ` +${matchedSelectionStudents.length - 5} more` : '';

    setConfirmModalConfig({
      isOpen: true,
      title: 'Confirm Deletion by Selection Numbers',
      message: `Are you sure you want to permanently delete the ${matchedSelectionStudents.length} student(s) matching selection numbers (${targetNumbers})? All associated assessment marks and attendance history will also be permanently deleted. Do you want to proceed?`,
      details: `Target Selection Numbers: ${targetNumbers} • Students: ${previewNames}${moreSuffix}`,
      variant: 'danger',
      confirmText: `Yes, Delete ${matchedSelectionStudents.length} Students`,
      cancelText: 'Cancel',
      onConfirm: () => {
        if (onBatchDeleteStudents) {
          onBatchDeleteStudents(targetIds);
        } else {
          targetIds.forEach(id => onDeleteStudent(id));
        }
        setSelectedStudentIds(prev => prev.filter(id => !targetIds.includes(id)));
        setNumberInputString('');
        setIsNumberDeleteModalOpen(false);
        setConfirmModalConfig(null);
      },
    });
  };

  // Handle Automatic Deduplication trigger
  const handleTriggerAutoCleanDuplicates = () => {
    if (totalDuplicatesCount === 0) {
      setDuplicateNotice('No duplicate students found! All records are unique and consistent.');
      setTimeout(() => setDuplicateNotice(null), 4000);
      return;
    }

    setConfirmModalConfig({
      isOpen: true,
      title: 'Confirm Automatic Duplicate Cleanup',
      message: `Are you sure you want to clean up duplicate students? The system will keep 1 consolidated canonical record for each student, safely merge all assessment marks and attendance histories, and permanently delete the ${totalDuplicatesCount} redundant duplicate copies.`,
      details: `Total Duplicate Groups: ${duplicateGroups.length} • Redundant Records to Delete: ${totalDuplicatesCount}`,
      variant: 'danger',
      confirmText: `Yes, Delete Duplicates & Leave One`,
      cancelText: 'Cancel',
      onConfirm: () => {
        if (onAutoCleanDuplicates) {
          const res = onAutoCleanDuplicates();
          setDuplicateNotice(
            `Successfully cleaned ${res.removedStudentCount} duplicate student(s)! Kept 1 canonical profile per student.`
          );
          setTimeout(() => setDuplicateNotice(null), 5000);
        }
        setIsDuplicateModalOpen(false);
        setConfirmModalConfig(null);
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Student Directory &amp; Records</h2>
          <p className="text-xs text-slate-500">
            Total of {db.students.length} students enrolled across {db.classes.length} classes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Clean Duplicates Button */}
          <button
            onClick={() => setIsDuplicateModalOpen(true)}
            className={`text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center space-x-1.5 border shadow-2xs ${
              totalDuplicatesCount > 0
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
            title="Scan and clean duplicate student records"
          >
            <Sparkles className={`w-3.5 h-3.5 ${totalDuplicatesCount > 0 ? 'text-amber-600' : 'text-slate-500'}`} />
            <span>Clean Duplicates</span>
            {totalDuplicatesCount > 0 && (
              <span className="bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full ml-0.5">
                {totalDuplicatesCount}
              </span>
            )}
          </button>

          {/* Delete by Numbers Button */}
          <button
            onClick={() => {
              setNumberInputString('');
              setIsNumberDeleteModalOpen(true);
            }}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center space-x-1.5 border border-slate-200 shadow-2xs"
            title="Delete students by their list row numbers (S/N)"
          >
            <Hash className="w-3.5 h-3.5 text-slate-600" />
            <span>Delete by Numbers</span>
          </button>

          <button
            onClick={() => setActiveTab('import-export')}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg transition"
          >
            Upload Spreadsheet
          </button>
          <button
            onClick={handleOpenAdd}
            className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search box */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name, ID, Admission No, phone..."
              className="w-full text-xs border border-slate-300 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Class Filter */}
          <div>
            <select
              value={filterClass}
              onChange={e => {
                const newCls = e.target.value;
                setFilterClass(newCls);
                const arms = newCls === 'ALL' ? [] : getSectionsForClass(newCls, db.classes, db.sections);
                if (arms.length === 0) {
                  setFilterSection('ALL');
                } else if (filterSection !== 'ALL' && !arms.includes(filterSection)) {
                  setFilterSection('ALL');
                }
              }}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Classes</option>
              {db.classes.map(c => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div>
            {filterClass !== 'ALL' && getSectionsForClass(filterClass, db.classes, db.sections).length === 0 ? (
              <div className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2 bg-slate-100 text-slate-500 italic flex items-center justify-between">
                <span>No Section</span>
              </div>
            ) : (
              <select
                value={filterSection}
                onChange={e => setFilterSection(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Sections</option>
                {(filterClass === 'ALL'
                  ? db.sections.map(s => s.name)
                  : getSectionsForClass(filterClass, db.classes, db.sections)
                ).map(secName => (
                  <option key={secName} value={secName}>
                    Section {secName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Graduated">Graduated</option>
              <option value="Withdrawn">Withdrawn</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span>
            Showing <strong className="text-slate-800">{filteredStudents.length}</strong> of{' '}
            {db.students.length} students
          </span>
          {(searchTerm || filterClass !== 'ALL' || filterSection !== 'ALL' || filterStatus !== 'Active') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterClass('ALL');
                setFilterSection('ALL');
                setFilterGender('ALL');
                setFilterStatus('Active');
              }}
              className="text-blue-700 hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Duplicate Action Status Notification Toast */}
      {duplicateNotice && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{duplicateNotice}</span>
          </div>
          <button
            onClick={() => setDuplicateNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Prominent Duplicate Records Detection Alert Banner */}
      {totalDuplicatesCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-700 flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                {totalDuplicatesCount} Duplicate Student Record{totalDuplicatesCount > 1 ? 's' : ''} Detected in Registry
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                {duplicateGroups.length} student group{duplicateGroups.length > 1 ? 's' : ''} share identical student IDs, admission numbers, or names &amp; classes. Automatically delete duplicate copies and leave exactly one canonical record per student.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={() => setIsDuplicateModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-100 transition shadow-2xs"
            >
              Review Duplicates ({duplicateGroups.length})
            </button>
            <button
              onClick={handleTriggerAutoCleanDuplicates}
              className="px-3.5 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition shadow-xs flex items-center space-x-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Delete Duplicates &amp; Leave One</span>
            </button>
          </div>
        </div>
      )}

      {/* Multi-Selection Batch Actions Toolbar */}
      {selectedStudentIds.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center space-x-2 text-xs font-semibold text-red-900">
            <span className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold">
              {selectedStudentIds.length}
            </span>
            <span>
              {selectedStudentIds.length} student{selectedStudentIds.length > 1 ? 's' : ''} selected
              {selectedStudentNumbers.length > 0 && (
                <span className="text-red-700 ml-1.5 font-mono text-[11px] font-normal">
                  (S/N: #{selectedStudentNumbers.slice(0, 10).join(', #')}
                  {selectedStudentNumbers.length > 10 ? ` +${selectedStudentNumbers.length - 10} more` : ''})
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedStudentIds([])}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition"
            >
              Deselect All
            </button>
            <button
              onClick={() => setIsNumberDeleteModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-red-200 hover:bg-red-100 text-red-800 rounded-lg transition flex items-center space-x-1"
            >
              <Hash className="w-3.5 h-3.5" />
              <span>Adjust by Numbers</span>
            </button>
            <button
              onClick={handleBatchDeleteClick}
              className="px-3.5 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center space-x-1.5 shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedStudentIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Student Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredStudents.length > 0 &&
                      selectedStudentIds.length === filteredStudents.length
                    }
                    onChange={handleToggleSelectAll}
                    aria-label="Select all students"
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-2 w-12 text-center text-slate-500 font-bold"># S/N</th>
                <th className="py-3 px-4">Student ID / Adm</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Class &amp; Arm</th>
                <th className="py-3 px-4">Gender</th>
                <th className="py-3 px-4">Parent &amp; Contact</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <UserCheck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No students match your filter criteria.</p>
                    <p className="text-xs text-slate-400 mt-1">Try clearing filters or add a new student.</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, index) => {
                  const isSelected = selectedStudentIds.includes(student.id);
                  const sNumber = index + 1;
                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                        isSelected ? 'bg-blue-50/50' : ''
                      }`}
                      onClick={() => setSelectedStudentForProfile(student)}
                    >
                      <td
                        className="py-3 px-3 text-center"
                        onClick={e => {
                          e.stopPropagation();
                          handleToggleSelectStudent(student.id);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectStudent(student.id)}
                          aria-label={`Select student ${student.name}`}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-2 text-center font-mono font-bold text-xs text-slate-500">
                        #{sNumber}
                      </td>

                      <td className="py-3 px-4 font-mono text-xs">
                        <div className="font-bold text-slate-900">{student.studentId}</div>
                        <div className="text-slate-400 text-[10px]">{student.admissionNumber}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{student.name}</div>
                        {student.address && (
                          <div className="text-[11px] text-slate-400 truncate max-w-xs">
                            {student.address}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">
                          {formatClassWithSection(student.className, student.section, db.classes)}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                            student.gender === 'Male'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-pink-50 text-pink-800 border border-pink-200'
                          }`}
                        >
                          {student.gender}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs">
                        <div className="font-medium text-slate-800">
                          {student.parentName || '-'}
                        </div>
                        <div className="text-slate-500 text-[11px] font-mono">
                          {student.parentPhone || ''}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            student.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {student.status}
                        </span>
                      </td>

                      <td
                        className="py-3 px-4 text-right space-x-1"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={() => setSelectedStudentForProfile(student)}
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-slate-100 rounded transition"
                          title="View Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            onSelectAssessmentStudent(
                              student.studentId,
                              student.className,
                              student.section
                            )
                          }
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition"
                          title="Enter Assessment Marks"
                        >
                          <ClipboardPenLine className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onSelectReportStudent(student.studentId)}
                          className="p-1.5 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded transition"
                          title="View Report Sheet"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(student)}
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded transition"
                          title="Edit Student"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(student)}
                          className="p-1.5 text-red-500 hover:text-white hover:bg-red-600 rounded transition"
                          title="Delete Student"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT STUDENT MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setIsFormOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {editingStudent ? 'Edit Student Details' : 'Register New Student'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter student information. Student ID and Admission Number must be unique.
            </p>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-800 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Student ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.studentId}
                    onChange={e => setFormData({ ...formData, studentId: e.target.value })}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. STU-2025-001"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Admission Number
                  </label>
                  <input
                    type="text"
                    value={formData.admissionNumber}
                    onChange={e => setFormData({ ...formData, admissionNumber: e.target.value })}
                    className="w-full text-xs font-mono border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. ADM/2025/001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-xs font-semibold border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Muhammad Ahmad Abubakar"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Class *
                  </label>
                  <select
                    value={formData.className}
                    onChange={e => {
                      const newCls = e.target.value;
                      const validSections = getSectionsForClass(newCls, db.classes, db.sections);
                      setFormData(prev => ({
                        ...prev,
                        className: newCls,
                        section: validSections.length === 0
                          ? ''
                          : validSections.includes(prev.section || '')
                          ? (prev.section || validSections[0])
                          : validSections[0],
                      }));
                    }}
                    className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
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
                    Section / Arm
                  </label>
                  {getSectionsForClass(formData.className || '', db.classes, db.sections).length === 0 ? (
                    <div className="w-full text-xs font-medium border border-slate-200 rounded p-2 bg-slate-100 text-slate-500 italic">
                      No Section (Class Only)
                    </div>
                  ) : (
                    <select
                      value={formData.section}
                      onChange={e => setFormData({ ...formData, section: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
                    >
                      {getSectionsForClass(formData.className || '', db.classes, db.sections).map(
                        secName => (
                          <option key={secName} value={secName}>
                            Section {secName}
                          </option>
                        )
                      )}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Gender *
                  </label>
                  <select
                    value={formData.gender}
                    onChange={e =>
                      setFormData({ ...formData, gender: e.target.value as 'Male' | 'Female' })
                    }
                    className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Graduated">Graduated</option>
                    <option value="Withdrawn">Withdrawn</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Parent / Guardian Name
                  </label>
                  <input
                    type="text"
                    value={formData.parentName}
                    onChange={e => setFormData({ ...formData, parentName: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2"
                    placeholder="e.g. Alhaji Ahmad Aliyu"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Parent Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.parentPhone}
                    onChange={e => setFormData({ ...formData, parentPhone: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2"
                    placeholder="08031112233"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Residential Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded p-2"
                  placeholder="e.g. Bole Street, Yola Town"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-xs font-semibold px-4 py-2 rounded text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-5 py-2 rounded-lg transition shadow"
                >
                  {editingStudent ? 'Save Changes' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STUDENT PROFILE PREVIEW MODAL */}
      {selectedStudentForProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => {
                setSelectedStudentForProfile(null);
                onClearSelectedStudentId?.();
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-800 font-bold text-lg flex items-center justify-center">
                {selectedStudentForProfile.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedStudentForProfile.name}
                </h3>
                <p className="text-xs font-mono text-slate-500">
                  {selectedStudentForProfile.studentId} &bull; {selectedStudentForProfile.admissionNumber}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs border-t border-slate-100 pt-3">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg">
                <div>
                  <span className="text-slate-500 font-semibold">Class Stream:</span>
                  <p className="font-bold text-slate-800">
                    {formatClassWithSection(selectedStudentForProfile.className, selectedStudentForProfile.section, db.classes)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Gender &amp; Status:</span>
                  <p className="font-bold text-slate-800">
                    {selectedStudentForProfile.gender} &bull; {selectedStudentForProfile.status}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 p-3 rounded-lg border border-slate-100">
                <div className="flex items-center text-slate-600">
                  <Calendar className="w-3.5 h-3.5 mr-2 text-slate-400" />
                  <span>DOB: {selectedStudentForProfile.dateOfBirth || 'Not specified'}</span>
                </div>
                <div className="flex items-center text-slate-600">
                  <Phone className="w-3.5 h-3.5 mr-2 text-slate-400" />
                  <span>
                    Parent: {selectedStudentForProfile.parentName || 'N/A'}{' '}
                    {selectedStudentForProfile.parentPhone ? `(${selectedStudentForProfile.parentPhone})` : ''}
                  </span>
                </div>
                <div className="flex items-center text-slate-600">
                  <MapPin className="w-3.5 h-3.5 mr-2 text-slate-400" />
                  <span>Address: {selectedStudentForProfile.address || 'N/A'}</span>
                </div>
              </div>

              {/* Assessment Records & Multi-Session History for this student */}
              <div className="pt-2 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase mb-2 flex items-center justify-between">
                    <span>Academic History &amp; Previous Terms</span>
                    <span className="text-[10px] text-slate-500 font-normal">All historical sessions</span>
                  </h4>

                  {/* Previous Historical Archives */}
                  {selectedStudentForProfile.academicHistory && selectedStudentForProfile.academicHistory.length > 0 && (
                    <div className="space-y-1.5 mb-2">
                      {selectedStudentForProfile.academicHistory.map((hist, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 rounded bg-amber-50/60 border border-amber-200 text-xs"
                        >
                          <div>
                            <span className="font-bold text-amber-950">
                              {hist.session} &bull; {hist.term} ({hist.className})
                            </span>
                            <div className="text-[11px] text-amber-800">
                              Avg: {hist.finalAverage ? `${hist.finalAverage}%` : 'N/A'} &bull; Pos: {hist.position || '-'} &bull; {hist.remark}
                            </div>
                          </div>
                          <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                            Historical Archive
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Current Assessments */}
                  {db.assessments.filter(a => a.studentId === selectedStudentForProfile.studentId)
                    .length === 0 && (!selectedStudentForProfile.academicHistory || selectedStudentForProfile.academicHistory.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">No academic assessment marks entered yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {db.assessments
                        .filter(a => a.studentId === selectedStudentForProfile.studentId)
                        .map(a => (
                          <div
                            key={a.id}
                            className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200 text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-800">
                                {a.academicSession} &bull; {a.term} ({a.className})
                              </span>
                              <div className="text-slate-500 text-[11px]">
                                Total: {a.totalScore} &bull; Avg: {a.finalAverage}% &bull; {a.promotionRemark}
                              </div>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs border border-emerald-200">
                                {a.finalPosition || 'Ranked'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStudentForProfile(null);
                                  onSelectReportStudent(selectedStudentForProfile.studentId);
                                }}
                                className="text-blue-700 hover:text-blue-900 text-xs font-semibold underline ml-1"
                              >
                                View Report
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Sibling Lookup */}
                {selectedStudentForProfile.parentName && (
                  <div className="p-2.5 rounded-lg bg-blue-50/50 border border-blue-100 text-xs">
                    <span className="font-bold text-blue-900">Registered Siblings in School:</span>
                    {(() => {
                      const siblings = db.students.filter(
                        s =>
                          s.id !== selectedStudentForProfile.id &&
                          ((s.parentPhone && s.parentPhone === selectedStudentForProfile.parentPhone) ||
                            (s.parentName && s.parentName.toLowerCase() === selectedStudentForProfile.parentName?.toLowerCase()))
                      );
                      if (siblings.length === 0) {
                        return <span className="text-slate-500 ml-1.5">No other children linked</span>;
                      }
                      return (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {siblings.map(sib => (
                            <span
                              key={sib.id}
                              className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-semibold text-[11px]"
                            >
                              {sib.name} ({sib.className})
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-100 mt-4">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const student = selectedStudentForProfile;
                    setSelectedStudentForProfile(null);
                    handleOpenEdit(student);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg flex items-center space-x-1"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteClick(selectedStudentForProfile);
                  }}
                  className="bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg flex items-center space-x-1 border border-red-200"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Student</span>
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setSelectedStudentForProfile(null);
                    onSelectAssessmentStudent(
                      selectedStudentForProfile.studentId,
                      selectedStudentForProfile.className,
                      selectedStudentForProfile.section
                    );
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center space-x-1"
                >
                  <ClipboardPenLine className="w-3.5 h-3.5" />
                  <span>Enter Assessment</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedStudentForProfile(null);
                    onSelectReportStudent(selectedStudentForProfile.studentId);
                  }}
                  className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center space-x-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Report</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: DELETE BY SELECTION NUMBERS                      */}
      {/* ========================================================= */}
      {isNumberDeleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
          onClick={e => {
            if (e.target === e.currentTarget) setIsNumberDeleteModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-200 relative animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <button
              onClick={() => setIsNumberDeleteModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-xl">
                <Hash className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete Students by Selection Numbers (S/N)
                </h3>
                <p className="text-xs text-slate-500">
                  Enter student list numbers or ranges to select and permanently delete them
                </p>
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Quick Preset Range Buttons */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Quick Select Presets
                </label>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setNumberInputString(
                        filteredStudents.length >= 10 ? '1-10' : `1-${filteredStudents.length}`
                      )
                    }
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold transition"
                  >
                    Numbers 1-10
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setNumberInputString(
                        filteredStudents.length >= 25 ? '1-25' : `1-${filteredStudents.length}`
                      )
                    }
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold transition"
                  >
                    Numbers 1-25
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setNumberInputString(
                        filteredStudents.length >= 50 ? '1-50' : `1-${filteredStudents.length}`
                      )
                    }
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold transition"
                  >
                    Numbers 1-50
                  </button>
                  <button
                    type="button"
                    onClick={() => setNumberInputString(`1-${filteredStudents.length}`)}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md font-semibold transition"
                  >
                    All ({filteredStudents.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNumberInputString('')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-md font-medium transition"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Number Input Field */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Enter Selection Numbers or Ranges
                </label>
                <input
                  type="text"
                  value={numberInputString}
                  onChange={e => setNumberInputString(e.target.value)}
                  placeholder="e.g. 2, 4, 7-10, 15, 22"
                  className="w-full text-sm font-mono border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-red-500"
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Separate single numbers with commas (e.g. <span className="font-mono">1, 4, 9</span>) or use a hyphen for ranges (e.g. <span className="font-mono">5-12</span>). Valid numbers: 1 to {filteredStudents.length}.
                </p>
              </div>

              {/* Interactive S/N Chip Cloud (First 60 students) */}
              {filteredStudents.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Click to Toggle S/N (Showing up to {Math.min(filteredStudents.length, 60)} students)
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                    {filteredStudents.slice(0, 60).map((stu, i) => {
                      const num = i + 1;
                      const isPicked = parsedSelectionNumbers.includes(num);
                      return (
                        <button
                          key={stu.id}
                          type="button"
                          onClick={() => {
                            const current = new Set(parsedSelectionNumbers);
                            if (current.has(num)) {
                              current.delete(num);
                            } else {
                              current.add(num);
                            }
                            setNumberInputString(Array.from(current).sort((a, b) => a - b).join(', '));
                          }}
                          className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition ${
                            isPicked
                              ? 'bg-red-600 text-white shadow-xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                          title={`#${num}: ${stu.name}`}
                        >
                          #{num}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Matched Students Live Preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">
                    Matched Students to Delete ({matchedSelectionStudents.length}):
                  </span>
                  {matchedSelectionStudents.length > 0 && (
                    <span className="text-xs text-red-700 font-mono font-semibold">
                      #{parsedSelectionNumbers.slice(0, 8).join(', #')}
                      {parsedSelectionNumbers.length > 8 ? ` +${parsedSelectionNumbers.length - 8} more` : ''}
                    </span>
                  )}
                </div>

                {matchedSelectionStudents.length === 0 ? (
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 italic">
                    Type selection numbers above (e.g. 1, 3, 5-8) or click numbers to preview matching students.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {matchedSelectionStudents.map(item => (
                      <div
                        key={item.student.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-red-50/60 border border-red-200 text-xs"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="w-8 h-6 rounded bg-red-600 text-white font-mono font-bold text-xs flex items-center justify-center">
                            #{item.number}
                          </span>
                          <div>
                            <div className="font-bold text-slate-900">{item.student.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {item.student.studentId} &bull; {item.student.admissionNumber}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {item.student.className} ({item.student.section})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsNumberDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleApplySelectionNumbersToTable}
                  disabled={matchedSelectionStudents.length === 0}
                  className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 rounded-lg transition disabled:opacity-50"
                >
                  Select in Table ({matchedSelectionStudents.length})
                </button>
                <button
                  type="button"
                  onClick={handleDeleteParsedNumbersClick}
                  disabled={matchedSelectionStudents.length === 0}
                  className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center space-x-1.5 shadow-xs disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected Numbers ({matchedSelectionStudents.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: DUPLICATE STUDENT RECORDS CLEANUP                */}
      {/* ========================================================= */}
      {isDuplicateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
          onClick={e => {
            if (e.target === e.currentTarget) setIsDuplicateModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 relative animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <button
              onClick={() => setIsDuplicateModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Duplicate Student Records Cleanup &amp; Consolidation
                </h3>
                <p className="text-xs text-slate-500">
                  Consolidate duplicate copies into exactly 1 canonical record without losing assessment marks or attendance
                </p>
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {totalDuplicatesCount === 0 ? (
                <div className="p-8 text-center bg-emerald-50/60 border border-emerald-200 rounded-xl">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-emerald-950">
                    No Duplicate Students Found!
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1 max-w-md mx-auto">
                    All {db.students.length} students currently registered in your database have unique Student IDs, Admission Numbers, and names.
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                    <p className="font-semibold">
                      Found {totalDuplicatesCount} duplicate record{totalDuplicatesCount > 1 ? 's' : ''} across {duplicateGroups.length} duplicate group{duplicateGroups.length > 1 ? 's' : ''}.
                    </p>
                    <p className="text-amber-800 text-[11px] mt-1">
                      When you click <strong>"Automatically Delete Duplicates &amp; Leave One"</strong>, the system will keep 1 canonical profile for each student, safely merge all terminal assessment marks, exam scores, and attendance records, and permanently remove the redundant duplicate copies.
                    </p>
                  </div>

                  {/* List of Duplicate Groups */}
                  <div className="space-y-3">
                    {duplicateGroups.map((group, gIdx) => {
                      const canonical = group.students[0];
                      const duplicates = group.students.slice(1);
                      return (
                        <div
                          key={group.key || gIdx}
                          className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                                {gIdx + 1}
                              </span>
                              <span>Group: {group.students[0].name}</span>
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-200 uppercase">
                              {group.reason.replace(/_/g, ' ')}
                            </span>
                          </div>

                          {/* Canonical Record to Keep */}
                          <div className="p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-xs flex items-center justify-between">
                            <div>
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold text-emerald-950">{canonical.name}</span>
                                <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-1.5 py-0.2 rounded">
                                  Canonical (Keep)
                                </span>
                              </div>
                              <div className="text-[11px] text-emerald-800 font-mono mt-0.5">
                                ID: {canonical.studentId} &bull; Adm: {canonical.admissionNumber} &bull; {canonical.className} ({canonical.section})
                              </div>
                            </div>
                          </div>

                          {/* Redundant Copies to Remove */}
                          <div className="space-y-1 pl-2">
                            {duplicates.map((dup, dIdx) => (
                              <div
                                key={dup.id || dIdx}
                                className="p-2 rounded-lg bg-red-50/70 border border-red-200 text-xs flex items-center justify-between"
                              >
                                <div>
                                  <div className="flex items-center space-x-1.5">
                                    <span className="font-semibold text-slate-800">{dup.name}</span>
                                    <span className="text-[10px] bg-red-200 text-red-900 font-bold px-1.5 py-0.2 rounded">
                                      Duplicate (Consolidate &amp; Delete)
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                    ID: {dup.studentId} &bull; Adm: {dup.admissionNumber} &bull; {dup.className} ({dup.section})
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsDuplicateModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Close
              </button>

              {totalDuplicatesCount > 0 && (
                <button
                  type="button"
                  onClick={handleTriggerAutoCleanDuplicates}
                  className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition flex items-center space-x-1.5 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Delete Duplicates &amp; Leave One</span>
                </button>
              )}
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
          cancelText={confirmModalConfig.cancelText}
          variant={confirmModalConfig.variant}
          onConfirm={confirmModalConfig.onConfirm}
          onCancel={() => setConfirmModalConfig(null)}
        />
      )}
    </div>
  );
};
