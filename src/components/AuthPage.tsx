import React, { useState } from 'react';
import { AppDatabase, UserAccount, SchoolSettings } from '../types';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  Building2,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  Phone,
  GraduationCap,
} from 'lucide-react';

interface AuthPageProps {
  db: AppDatabase;
  onLoginSuccess: (user: UserAccount) => void;
  onInitializeSuperAdmin: (user: UserAccount, settings: SchoolSettings) => void;
  onLoadDemoData: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  db,
  onLoginSuccess,
  onInitializeSuperAdmin,
  onLoadDemoData,
}) => {
  const hasUsers = db.users && db.users.length > 0;

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Initial Setup State (When 0 users exist)
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');

  const [schoolName, setSchoolName] = useState('');
  const [arabicSchoolName, setArabicSchoolName] = useState('');
  const [schoolMotto, setSchoolMotto] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [schoolPhone, setSchoolPhone] = useState('');
  const [academicSession, setAcademicSession] = useState('');
  const [initialTerm, setInitialTerm] = useState('1st Term');

  // Handle Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const identifierClean = loginIdentifier.trim().toLowerCase();
    const user = db.users.find(
      u =>
        u.email.toLowerCase() === identifierClean ||
        (u.username && u.username.toLowerCase() === identifierClean)
    );

    if (!user) {
      setAuthError('Invalid email/username or user does not exist.');
      return;
    }

    if (user.status === 'disabled') {
      setAuthError('This account is disabled. Please contact the Super Admin.');
      return;
    }

    if (user.passwordHash !== loginPassword) {
      setAuthError('Incorrect password. Please try again.');
      return;
    }

    // Login success
    const updatedUser: UserAccount = {
      ...user,
      lastLoginAt: new Date().toISOString(),
    };
    onLoginSuccess(updatedUser);
  };

  // Handle Initial Super Admin & School Setup
  const handleInitialSetup = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!adminFullName.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      setAuthError('Please complete all required Super Admin fields.');
      return;
    }

    if (adminPassword !== adminPasswordConfirm) {
      setAuthError('Super Admin passwords do not match.');
      return;
    }

    if (adminPassword.length < 5) {
      setAuthError('Password must be at least 5 characters long.');
      return;
    }

    if (!schoolName.trim()) {
      setAuthError('Please enter your School Name.');
      return;
    }

    if (!academicSession.trim()) {
      setAuthError('Please enter the current Academic Session (e.g. 2026/2027).');
      return;
    }

    const newSuperAdmin: UserAccount = {
      id: `usr-${Date.now()}`,
      email: adminEmail.trim(),
      username: adminEmail.split('@')[0].toLowerCase(),
      fullName: adminFullName.trim(),
      phone: adminPhone.trim(),
      passwordHash: adminPassword,
      role: 'super_admin',
      schoolId: db.schoolId || 'school-main',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    const newSettings: SchoolSettings = {
      ...db.settings,
      schoolId: db.schoolId || 'school-main',
      schoolName: schoolName.trim(),
      arabicSchoolName: arabicSchoolName.trim(),
      motto: schoolMotto.trim() || 'شعارنا: خيركم من تعلم القرآن وعلمه',
      address: schoolAddress.trim(),
      telephone: schoolPhone.trim() || adminPhone.trim(),
      email: adminEmail.trim(),
      currentSession: academicSession.trim(),
      currentTerm: initialTerm,
      isSetupComplete: true,
      useSections: true,
    };

    onInitializeSuperAdmin(newSuperAdmin, newSettings);
  };

  // Quick fill demo user credentials
  const handleQuickFill = (user: UserAccount) => {
    setLoginIdentifier(user.email);
    setLoginPassword(user.passwordHash);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Emblem / Badge */}
        <div className="mx-auto w-14 h-14 bg-emerald-600 rounded-2xl shadow-lg flex items-center justify-center text-white mb-3">
          <GraduationCap className="w-8 h-8" />
        </div>

        {db.settings.arabicSchoolName && (
          <p className="font-amiri text-lg font-bold text-emerald-400 leading-snug">
            {db.settings.arabicSchoolName}
          </p>
        )}

        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
          {db.settings.schoolName || 'Islamic School Management System'}
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Secure Multi-User Portal &bull; Super Admin, Staff &amp; Teachers
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100">
          {authError && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* CASE 1: NO USERS EXIST -> INITIAL SUPER ADMIN & SCHOOL REGISTRATION */}
          {!hasUsers ? (
            <form onSubmit={handleInitialSetup} className="space-y-4">
              <div className="border-b border-slate-200 pb-3 mb-2">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">
                  Step 1 &bull; Initial Installation Setup
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Create School &amp; Super Admin Account
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  No default data exists. Register the school&apos;s Super Admin to begin.
                </p>
              </div>

              {/* Super Admin Credentials */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block">
                  Super Administrator Credentials
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={adminFullName}
                      onChange={e => setAdminFullName(e.target.value)}
                      className="w-full text-xs font-semibold border border-slate-300 rounded p-2"
                      placeholder="e.g. Mallam Abubakar Lamido"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded p-2"
                      placeholder="admin@school.edu"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={adminPhone}
                      onChange={e => setAdminPhone(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded p-2"
                      placeholder="0803XXXXXXX"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded p-2"
                      placeholder="Minimum 5 characters"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Confirm Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={adminPasswordConfirm}
                      onChange={e => setAdminPasswordConfirm(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded p-2"
                      placeholder="Re-enter password"
                    />
                  </div>
                </div>
              </div>

              {/* School Details */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block">
                  School Details
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      School Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={schoolName}
                      onChange={e => setSchoolName(e.target.value)}
                      className="w-full text-xs font-semibold border border-slate-300 rounded p-2"
                      placeholder="e.g. AT-TAHFIZU WAL ITQAN ISLAMIYYA"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Arabic School Name (الاسم بالعربية)
                    </label>
                    <input
                      type="text"
                      dir="rtl"
                      value={arabicSchoolName}
                      onChange={e => setArabicSchoolName(e.target.value)}
                      className="w-full text-sm font-amiri font-bold border border-slate-300 rounded p-2"
                      placeholder="مدرسة التحفيظ والإتقان الإسلامية"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Academic Session *
                    </label>
                    <input
                      type="text"
                      required
                      value={academicSession}
                      onChange={e => setAcademicSession(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded p-2"
                      placeholder="e.g. 2026/2027"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Starting Term
                    </label>
                    <select
                      value={initialTerm}
                      onChange={e => setInitialTerm(e.target.value)}
                      className="w-full text-xs font-semibold border border-slate-300 rounded p-2 bg-white"
                    >
                      <option value="1st Term">1st Term</option>
                      <option value="2nd Term">2nd Term</option>
                      <option value="3rd Term">3rd Term</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      School Motto
                    </label>
                    <input
                      type="text"
                      value={schoolMotto}
                      onChange={e => setSchoolMotto(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded p-2"
                      placeholder="شعارنا: خيركم من تعلم القرآن وعلمه"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm py-3 px-4 rounded-xl transition shadow flex items-center justify-center space-x-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Initialize Portal &amp; Create Super Admin</span>
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100 text-center">
                <span className="text-[11px] text-slate-500 block mb-2">
                  Need sample testing data during development?
                </span>
                <button
                  type="button"
                  onClick={onLoadDemoData}
                  className="text-xs text-blue-700 hover:underline font-bold inline-flex items-center space-x-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Load Sample Demo Data (22 Students &amp; Teachers)</span>
                </button>
              </div>
            </form>
          ) : (
            /* CASE 2: NORMAL SECURE LOGIN SCREEN */
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Email Address or Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={e => setLoginIdentifier(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    placeholder="e.g. admin@school.edu or username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    className="block w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    placeholder="Enter account password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs sm:text-sm py-3 px-4 rounded-xl transition shadow flex items-center justify-center space-x-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>Sign In to School Portal</span>
                </button>
              </div>

              {/* Demo users quick-fill if present */}
              {db.users.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700 block mb-1.5">
                    Quick Demo Credentials:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {db.users.slice(0, 3).map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleQuickFill(u)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium"
                      >
                        {u.role === 'super_admin' ? 'Super Admin' : u.role === 'teacher' ? 'Teacher' : 'Staff'} ({u.email})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          )}
        </div>

        <div className="text-center mt-6 text-xs text-slate-400">
          Powered by{' '}
          <strong className="text-slate-300">
            M-SAGEER DIGITAL TECHNOLOGIES LTD &bull; 07066979027
          </strong>
        </div>
      </div>
    </div>
  );
};
