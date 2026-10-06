import React, { useState } from 'react';
import {
  AppDatabase,
  UserAccount,
  UserRole,
  StaffPermission,
} from '../types';
import {
  Users,
  UserPlus,
  Shield,
  UserCheck,
  GraduationCap,
  KeyRound,
  CheckCircle,
  XCircle,
  Trash2,
  X,
  AlertCircle,
  Lock,
} from 'lucide-react';

interface UserManagementProps {
  db: AppDatabase;
  currentUser: UserAccount;
  onSaveUser: (user: UserAccount) => void;
  onDeleteUser: (userId: string) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  db,
  currentUser,
  onSaveUser,
  onDeleteUser,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserAccount | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('teacher');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  // Teacher specific
  const [assignedClass, setAssignedClass] = useState(db.classes[0]?.name || '');
  const [assignedSection, setAssignedSection] = useState(db.sections[0]?.name || '');
  const [assignedSession, setAssignedSession] = useState(db.settings.currentSession || '');

  // Staff specific permissions
  const [permissions, setPermissions] = useState<StaffPermission[]>([
    'students',
    'assessment',
    'attendance',
    'reports',
  ]);

  const allAvailablePermissions: Array<{ id: StaffPermission; label: string }> = [
    { id: 'students', label: 'Students Directory & Profile' },
    { id: 'assessment', label: 'Enter & Edit Assessment Scores' },
    { id: 'attendance', label: 'Record & Manage Attendance' },
    { id: 'reports', label: 'Generate & Preview Report Sheets' },
    { id: 'class-summary', label: 'View & Print Class Broadsheet' },
    { id: 'promotion', label: 'Student Promotion Tool' },
    { id: 'import-export', label: 'Spreadsheet Import & Export' },
    { id: 'settings', label: 'School Settings Configuration' },
  ];

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFullName('');
    setEmail('');
    setUsername('');
    setPhone('');
    setRole('teacher');
    setPassword('');
    setPasswordConfirm('');
    setAssignedClass(db.classes[0]?.name || '');
    setAssignedSection(db.sections[0]?.name || '');
    setAssignedSession(db.settings.currentSession || '');
    setPermissions(['students', 'assessment', 'attendance', 'reports']);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: UserAccount) => {
    setEditingUser(user);
    setFullName(user.fullName);
    setEmail(user.email);
    setUsername(user.username || '');
    setPhone(user.phone || '');
    setRole(user.role);
    setPassword('');
    setPasswordConfirm('');
    setAssignedClass(user.assignedClass || db.classes[0]?.name || '');
    setAssignedSection(user.assignedSection || db.sections[0]?.name || '');
    setAssignedSession(user.assignedSession || db.settings.currentSession || '');
    setPermissions(user.permissions || []);
    setIsModalOpen(true);
  };

  const togglePermission = (permId: StaffPermission) => {
    setPermissions(prev =>
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
  };

  const handleSubmitUser = (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingUser) {
      if (!password) {
        alert('Password is required for new accounts.');
        return;
      }
      if (password !== passwordConfirm) {
        alert('Passwords do not match.');
        return;
      }
      if (password.length < 5) {
        alert('Password must be at least 5 characters long.');
        return;
      }
    }

    const emailClean = email.trim().toLowerCase();
    const existing = db.users.find(
      u => u.email.toLowerCase() === emailClean && u.id !== editingUser?.id
    );
    if (existing) {
      alert(`User with email "${emailClean}" already exists.`);
      return;
    }

    const userToSave: UserAccount = {
      id: editingUser ? editingUser.id : `usr-${Date.now()}`,
      email: emailClean,
      username: username.trim() || emailClean.split('@')[0],
      fullName: fullName.trim(),
      phone: phone.trim(),
      passwordHash: password ? password : (editingUser ? editingUser.passwordHash : '12345'),
      role,
      schoolId: db.schoolId || 'school-main',
      status: editingUser ? editingUser.status : 'active',
      assignedClass: role === 'teacher' ? assignedClass : undefined,
      assignedSection: role === 'teacher' ? assignedSection : undefined,
      assignedSession: role === 'teacher' ? assignedSession : undefined,
      permissions: role === 'staff' ? permissions : undefined,
      createdAt: editingUser ? editingUser.createdAt : new Date().toISOString(),
      lastLoginAt: editingUser?.lastLoginAt,
    };

    onSaveUser(userToSave);
    setIsModalOpen(false);
    showNotification(`User account for "${userToSave.fullName}" saved successfully.`);
  };

  // Toggle user status
  const handleToggleStatus = (user: UserAccount) => {
    if (user.id === currentUser.id || user.email.toLowerCase() === 'alaminkaigama@gmail.com') {
      alert('The primary Super Admin account (alaminkaigama@gmail.com) cannot be disabled.');
      return;
    }
    const updated: UserAccount = {
      ...user,
      status: user.status === 'active' ? 'disabled' : 'active',
    };
    onSaveUser(updated);
    showNotification(`Account status updated for ${user.fullName}.`);
  };

  // Password Reset
  const handleConfirmPasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || !newPasswordVal.trim()) return;

    const updated: UserAccount = {
      ...resetPasswordUser,
      passwordHash: newPasswordVal.trim(),
    };
    onSaveUser(updated);
    setResetPasswordUser(null);
    setNewPasswordVal('');
    showNotification(`Password reset successfully for ${resetPasswordUser.fullName}.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">User Accounts &amp; Access Control</h2>
          <p className="text-xs text-slate-500">
            Create and manage Super Admin, Staff, and Teacher accounts. Assign classes and permissions.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create User</span>
        </button>
      </div>

      {notification && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Name &amp; Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Assigned Class / Permissions</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.users.map(user => {
                const isSuperAdmin = user.role === 'super_admin';
                const isTeacher = user.role === 'teacher';
                const isStaff = user.role === 'staff';

                return (
                  <tr key={user.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{user.fullName}</div>
                      <div className="text-slate-500 text-xs font-mono">{user.email}</div>
                    </td>

                    <td className="py-3 px-4">
                      {isSuperAdmin && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                          <Shield className="w-3 h-3 text-blue-600" />
                          <span>Super Admin</span>
                        </span>
                      )}
                      {isTeacher && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                          <GraduationCap className="w-3 h-3 text-emerald-600" />
                          <span>Teacher</span>
                        </span>
                      )}
                      {isStaff && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                          <UserCheck className="w-3 h-3 text-purple-600" />
                          <span>Staff / Admin</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-xs">
                      {isTeacher && (
                        <div>
                          <span className="font-bold text-slate-800">
                            {user.assignedClass || 'Unassigned'}
                          </span>
                          {user.assignedSection && (
                            <span className="text-slate-500 ml-1">
                              (Section {user.assignedSection})
                            </span>
                          )}
                          <div className="text-[11px] text-slate-400">
                            Session: {user.assignedSession || db.settings.currentSession}
                          </div>
                        </div>
                      )}
                      {isStaff && (
                        <div className="text-[11px] text-slate-600">
                          {user.permissions && user.permissions.length > 0 ? (
                            <span>{user.permissions.length} module(s) permitted</span>
                          ) : (
                            <span className="text-slate-400 italic">No modules permitted</span>
                          )}
                        </div>
                      )}
                      {isSuperAdmin && (
                        <span className="text-slate-500 font-semibold italic text-xs">
                          Full Access (All Modules)
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(user)}
                        disabled={user.id === currentUser.id || user.email.toLowerCase() === 'alaminkaigama@gmail.com'}
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-semibold ${
                          user.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-red-50 text-red-700 hover:bg-red-100'
                        } ${user.email.toLowerCase() === 'alaminkaigama@gmail.com' ? 'opacity-80 cursor-not-allowed' : ''}`}
                      >
                        {user.status === 'active' ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-red-600" />
                            <span>Disabled</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-xs text-slate-500">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                    </td>

                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => setResetPasswordUser(user)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded transition"
                        title="Reset Password"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(user)}
                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1 rounded transition"
                      >
                        Edit
                      </button>
                      {user.id !== currentUser.id && user.email.toLowerCase() !== 'alaminkaigama@gmail.com' && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete user account for "${user.fullName}"?`)) {
                              onDeleteUser(user.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {editingUser ? 'Edit User Account' : 'Create New User Account'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Configure user role, authentication credentials, and class/module permissions.
            </p>

            <form onSubmit={handleSubmitUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-600"
                  placeholder="e.g. Ustaza Aisha Muhammad Ardo"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Email / Login ID *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-600"
                    placeholder="user@school.edu"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded p-2"
                    placeholder="080XXXXXXXX"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  User Role *
                </label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                  className="w-full text-xs font-bold border border-slate-300 rounded p-2 bg-white text-slate-900"
                >
                  <option value="teacher">Teacher (Class &amp; Section Restricted)</option>
                  <option value="staff">Admin / Staff (Permission Checkboxes)</option>
                  <option value="super_admin">Super Admin (Full Unrestricted Access)</option>
                </select>
              </div>

              {/* Password (Only required on add or if modifying) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    {editingUser ? 'New Password (Optional)' : 'Password *'}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded p-2"
                    placeholder={editingUser ? 'Leave blank to keep current' : 'Min 5 characters'}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={e => setPasswordConfirm(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded p-2"
                    placeholder="Re-enter password"
                  />
                </div>
              </div>

              {/* IF TEACHER: ASSIGN CLASS & SECTION */}
              {role === 'teacher' && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-3">
                  <span className="font-bold text-emerald-950 uppercase tracking-wider block">
                    Teacher Class Assignment (Strict Data Isolation)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Assigned Class</label>
                      <select
                        value={assignedClass}
                        onChange={e => setAssignedClass(e.target.value)}
                        className="w-full text-xs font-bold border border-slate-300 rounded p-2 bg-white"
                      >
                        {db.classes.length === 0 ? (
                          <option value="">No classes created yet</option>
                        ) : (
                          db.classes.map(c => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Section</label>
                      <select
                        value={assignedSection}
                        onChange={e => setAssignedSection(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-300 rounded p-2 bg-white"
                      >
                        {db.sections.length === 0 ? (
                          <option value="">No sections</option>
                        ) : (
                          db.sections.map(s => (
                            <option key={s.id} value={s.name}>
                              Section {s.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Session</label>
                      <input
                        type="text"
                        value={assignedSession}
                        onChange={e => setAssignedSession(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-300 rounded p-2"
                        placeholder="e.g. 2026/2027"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    This teacher will only be permitted to view students, enter marks, and access reports for their assigned class.
                  </p>
                </div>
              )}

              {/* IF STAFF: PERMISSION CHECKBOXES */}
              {role === 'staff' && (
                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg space-y-2.5">
                  <span className="font-bold text-purple-950 uppercase tracking-wider block">
                    Staff Permission Modules
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {allAvailablePermissions.map(perm => {
                      const isChecked = permissions.includes(perm.id);
                      return (
                        <label
                          key={perm.id}
                          className="flex items-center space-x-2 text-slate-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(perm.id)}
                            className="rounded text-purple-600 focus:ring-purple-500"
                          />
                          <span>{perm.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs font-semibold px-4 py-2 rounded text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs px-5 py-2 rounded-lg transition shadow"
                >
                  {editingUser ? 'Save User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 relative">
            <button
              onClick={() => setResetPasswordUser(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1">
              Reset Password
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter a new password for <strong>{resetPasswordUser.fullName}</strong> ({resetPasswordUser.email}).
            </p>

            <form onSubmit={handleConfirmPasswordReset} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  value={newPasswordVal}
                  onChange={e => setNewPasswordVal(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded p-2"
                  placeholder="Enter new password"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-1.5 rounded-lg transition shadow"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
