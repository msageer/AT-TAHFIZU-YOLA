import React, { useState, useEffect } from 'react';
import { Student, AppDatabase, NavigationTab, UserAccount } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { getSectionsForClass, formatClassWithSection } from '../utils/classSections';
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
  Lock,
} from 'lucide-react';

interface StudentsProps {
  db: AppDatabase;
  currentUser?: UserAccount;
  initialSelectedStudentId?: string | null;
  onClearSelectedStudentId?: () => void;
  onSaveStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  onBatchDeleteStudents?: (studentIds: string[]) => void;
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
    // If teacher, strictly enforce their assigned class
    if (isTeacher && teacherClass && student.className !== teacherClass) return false;
    if (isTeacher && teacherSection && student.section !== teacherSection) return false;

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

    if (!isTeacher && filterClass !== 'ALL' && student.className !== filterClass) return false;
    if (!isTeacher && filterSection !== 'ALL') {
      const clsArms = getSectionsForClass(student.className, db.classes, db.sections);
      if (clsArms.length > 0 && student.section !== filterSection) return false;
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

        <div className="flex items-center space-x-2">
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

      {/* Multi-Selection Batch Actions Toolbar */}
      {selectedStudentIds.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center space-x-2 text-xs font-semibold text-red-900">
            <span className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold">
              {selectedStudentIds.length}
            </span>
            <span>
              {selectedStudentIds.length} student{selectedStudentIds.length > 1 ? 's' : ''} selected
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
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <UserCheck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No students match your filter criteria.</p>
                    <p className="text-xs text-slate-400 mt-1">Try clearing filters or add a new student.</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => {
                  const isSelected = selectedStudentIds.includes(student.id);
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
