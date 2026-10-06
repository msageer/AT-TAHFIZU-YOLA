import React, { useState } from 'react';
import { AppDatabase, UserAccount, SchoolSettings } from '../types';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  GraduationCap,
  ArrowRight,
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
  // Always default to login! The admin initial onboarding can only be done once.
  const [viewMode, setViewMode] = useState<'login' | 'initial_setup'>('login');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('admin@school.edu');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Initial Setup State (Only available once if initial setup was never completed)
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');

  const [schoolName, setSchoolName] = useState('');
  const [arabicSchoolName, setArabicSchoolName] = useState('');
  const [schoolMotto, setSchoolMotto] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [academicSession, setAcademicSession] = useState('2026/2027');
  const [initialTerm, setInitialTerm] = useState('1st Term');

  // Handle Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const identifierClean = loginIdentifier.trim().toLowerCase();
    const user = (db.users || []).find(
      u =>
        u.email.toLowerCase() === identifierClean ||
        (u.username && u.username.toLowerCase() === identifierClean)
    );

    if (!user) {
      setAuthError('Invalid email/username. Please check your credentials.');
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

  // Handle Initial Super Admin & School Setup (Done ONLY ONCE)
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
      motto: schoolMotto.trim() || 'خيركم من تعلم القرآن وعلمه',
      address: schoolAddress.trim(),
      telephone: adminPhone.trim(),
      email: adminEmail.trim(),
      currentSession: academicSession.trim() || '2026/2027',
      currentTerm: initialTerm,
      isSetupComplete: true, // Permanently marked as complete!
      useSections: true,
    };

    onInitializeSuperAdmin(newSuperAdmin, newSettings);
  };

  // Quick fill user credentials
  const handleQuickFill = (user: UserAccount) => {
    setLoginIdentifier(user.email);
    setLoginPassword(user.passwordHash);
    setAuthError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Emblem */}
        <div className="mx-auto w-14 h-14 bg-emerald-600 rounded-2xl shadow-xl flex items-center justify-center text-white mb-3 ring-4 ring-emerald-500/20">
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
        <p className="mt-1 text-xs text-slate-300">
          Secure Portal &bull; Super Admin, Staff &amp; Class Teachers
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100">
          {authError && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* ========================================================= */}
          {/* STANDARD VIEW: LOGIN FORM (ALWAYS SHOWN TO VISITORS)     */}
          {/* ========================================================= */}
          {viewMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="border-b border-slate-100 pb-3 mb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                    Sign In to Portal
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Enter your email or username to access your school dashboard
                  </p>
                </div>
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                  <Lock className="w-4 h-4" />
                </span>
              </div>

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
                    className="block w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none bg-slate-50/50 focus:bg-white"
                    placeholder="e.g. admin@school.edu or admin"
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
                    className="block w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none bg-slate-50/50 focus:bg-white"
                    placeholder="Enter your account password"
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

              {/* Quick Fill Credentials */}
              {(db.users || []).length > 0 && (
                <div className="mt-4 pt-3.5 border-t border-slate-100 text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
                      Quick Demo Credentials:
                    </span>
                    <span className="text-[10px] text-slate-400">Click to fill</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    {(db.users || []).slice(0, 3).map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleQuickFill(u)}
                        className={`px-2.5 py-1.5 rounded-lg border text-left transition text-[11px] ${
                          u.role === 'super_admin'
                            ? 'bg-purple-50/80 border-purple-200 text-purple-900 hover:bg-purple-100'
                            : u.role === 'teacher'
                            ? 'bg-amber-50/80 border-amber-200 text-amber-900 hover:bg-amber-100'
                            : 'bg-blue-50/80 border-blue-200 text-blue-900 hover:bg-blue-100'
                        }`}
                      >
                        <strong className="block truncate capitalize">
                          {u.role === 'super_admin' ? 'Super Admin' : u.role}
                        </strong>
                        <span className="text-[10px] opacity-75 truncate block">{u.email}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional: Load Full Demo Data */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={onLoadDemoData}
                  className="text-[11px] text-blue-700 hover:underline font-semibold inline-flex items-center space-x-1"
                >
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>Reset / Load Full Demo School Dataset</span>
                </button>
              </div>
            </form>
          ) : (
            /* ========================================================= */
            /* ONE-TIME INITIAL SETUP (ONLY IF EXPLICITLY SWITCHED TO)   */
            /* ========================================================= */
            <form onSubmit={handleInitialSetup} className="space-y-4">
              <div className="border-b border-slate-200 pb-3 mb-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                    One-Time Initial Setup
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    Configure Initial Super Admin
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode('login')}
                  className="text-xs text-blue-700 hover:underline font-semibold"
                >
                  Back to Login
                </button>
              </div>

              {/* Admin Inputs */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block">
                  Super Admin Details
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={adminFullName}
                      onChange={e => setAdminFullName(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded p-1.5"
                      placeholder="e.g. Mallam Abubakar Lamido"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded p-1.5"
                      placeholder="admin@school.edu"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase">
                      Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded p-1.5"
                      placeholder="Min 5 chars"
                    />
                  </div>
                </div>
              </div>

              {/* School Info */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block">
                  School Information
                </span>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase">
                    School Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={schoolName}
                    onChange={e => setSchoolName(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded p-1.5"
                    placeholder="e.g. AT-TAHFIZU WAL ITQAN ISLAMIYYA"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase">
                    Arabic School Name (الاسم بالعربية)
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={arabicSchoolName}
                    onChange={e => setArabicSchoolName(e.target.value)}
                    className="w-full text-xs font-amiri border border-slate-300 rounded p-1.5"
                    placeholder="مدرسة التحفيظ والإتقان الإسلامية"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition shadow flex items-center justify-center space-x-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Complete Initial Setup &amp; Launch Portal</span>
                </button>
              </div>
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
