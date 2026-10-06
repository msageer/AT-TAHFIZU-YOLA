import React, { useState } from 'react';
import { AppDatabase, UserAccount } from '../types';
import {
  Lock,
  Mail,
  GraduationCap,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react';

interface AuthPageProps {
  db: AppDatabase;
  onLoginSuccess: (user: UserAccount) => void;
  onLoadDemoData?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  db,
  onLoginSuccess,
}) => {
  // Login form state - starts completely blank with no credentials autofilled or displayed
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Handle Login submission
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const identifierClean = loginIdentifier.trim().toLowerCase();
    const user = (db.users || []).find(
      u =>
        u.email.toLowerCase().trim() === identifierClean ||
        (u.username && u.username.toLowerCase().trim() === identifierClean)
    );

    if (!user) {
      setAuthError('Invalid email or username. Only authorized school accounts can sign in.');
      return;
    }

    if (user.status === 'disabled') {
      setAuthError('This account has been disabled. Please contact your school administrator.');
      return;
    }

    if (user.passwordHash !== loginPassword) {
      setAuthError('Incorrect password. Please verify and try again.');
      return;
    }

    // Login success
    const updatedUser: UserAccount = {
      ...user,
      lastLoginAt: new Date().toISOString(),
    };
    onLoginSuccess(updatedUser);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Emblem / Logo */}
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

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-8 border border-slate-100">
          {authError && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="border-b border-slate-100 pb-3 mb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Sign In to Portal
                </h3>
                <p className="text-[11px] text-slate-500">
                  Please enter your login credentials to continue
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
                  autoComplete="username"
                  value={loginIdentifier}
                  onChange={e => setLoginIdentifier(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none bg-slate-50/50 focus:bg-white text-slate-900"
                  placeholder="Enter your email or username"
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
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="block w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none bg-slate-50/50 focus:bg-white text-slate-900"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs sm:text-sm py-3 px-4 rounded-xl transition shadow flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Sign In to School Portal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
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
