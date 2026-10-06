import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardPenLine,
  CalendarCheck,
  FileText,
  TableProperties,
  ArrowUpRight,
  FileSpreadsheet,
  Settings,
  Sparkles,
  Shield,
  UserCheck,
  LogOut,
  ShieldAlert,
  ChevronDown,
} from 'lucide-react';
import { SchoolSettings, NavigationTab, UserAccount } from '../types';

export type { NavigationTab };

interface NavbarProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  settings: SchoolSettings;
  currentUser: UserAccount;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  settings,
  currentUser,
  onLogout,
}) => {
  const isSuperAdmin = currentUser.role === 'super_admin';
  const isTeacher = currentUser.role === 'teacher';
  const isStaff = currentUser.role === 'staff';

  // Base list of navigation items
  const allNavItems: Array<{
    id: NavigationTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    allowed: boolean;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      allowed: true,
    },
    {
      id: 'students',
      label: isTeacher ? 'My Students' : 'Students',
      icon: Users,
      allowed:
        isSuperAdmin ||
        isTeacher ||
        (isStaff && (currentUser.permissions?.includes('students') ?? true)),
    },
    {
      id: 'classes',
      label: isTeacher ? 'My Class' : 'Classes',
      icon: GraduationCap,
      allowed:
        isSuperAdmin ||
        isTeacher ||
        (isStaff && (currentUser.permissions?.includes('classes') ?? true)),
    },
    {
      id: 'assessment',
      label: 'Assessment',
      icon: ClipboardPenLine,
      allowed:
        isSuperAdmin ||
        isTeacher ||
        (isStaff && (currentUser.permissions?.includes('assessment') ?? true)),
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: CalendarCheck,
      allowed:
        isSuperAdmin ||
        isTeacher ||
        (isStaff && (currentUser.permissions?.includes('attendance') ?? true)),
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FileText,
      allowed:
        isSuperAdmin ||
        isTeacher ||
        (isStaff && (currentUser.permissions?.includes('reports') ?? true)),
    },
    {
      id: 'class-summary',
      label: 'Class Summary',
      icon: TableProperties,
      allowed:
        isSuperAdmin ||
        isTeacher ||
        (isStaff && (currentUser.permissions?.includes('class-summary') ?? true)),
    },
    {
      id: 'promotion',
      label: 'Promotion',
      icon: ArrowUpRight,
      allowed:
        isSuperAdmin ||
        (isStaff && (currentUser.permissions?.includes('promotion') ?? false)),
    },
    {
      id: 'import-export',
      label: 'Import / Export',
      icon: FileSpreadsheet,
      allowed:
        isSuperAdmin ||
        (isStaff && (currentUser.permissions?.includes('import-export') ?? false)),
    },
    {
      id: 'users',
      label: 'Users & Roles',
      icon: Shield,
      allowed: isSuperAdmin,
    },
    {
      id: 'audit-log',
      label: 'Audit Trail',
      icon: ShieldAlert,
      allowed: isSuperAdmin,
    },
    {
      id: 'settings',
      label: 'School Setup',
      icon: Settings,
      allowed:
        isSuperAdmin ||
        (isStaff && (currentUser.permissions?.includes('settings') ?? false)),
    },
  ];

  const visibleNavItems = allNavItems.filter(item => item.allowed);

  const getRoleBadge = () => {
    if (isSuperAdmin) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-900/90 text-purple-200 border border-purple-600">
          <Shield className="w-2.5 h-2.5 text-purple-300" />
          <span>Super Admin</span>
        </span>
      );
    }
    if (isTeacher) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-900/90 text-amber-200 border border-amber-600">
          <UserCheck className="w-2.5 h-2.5 text-amber-300" />
          <span>Teacher &bull; {currentUser.assignedClass || 'Class'} {currentUser.assignedSection ? `(${currentUser.assignedSection})` : ''}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-900/90 text-blue-200 border border-blue-600">
        <Users className="w-2.5 h-2.5 text-blue-300" />
        <span>Staff Member</span>
      </span>
    );
  };

  return (
    <header className="bg-slate-900 text-white shadow-md border-b border-slate-800 no-print sticky top-0 z-40">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 border-b border-slate-800/80">
          <div
            className="flex items-center space-x-3 cursor-pointer"
            onClick={() => setActiveTab('dashboard')}
          >
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt="Logo"
                className="w-10 h-10 object-contain bg-white rounded p-0.5"
              />
            ) : (
              <div className="w-10 h-10 bg-emerald-600 rounded flex items-center justify-center font-bold text-white text-lg">
                IS
              </div>
            )}
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-600 text-emerald-100 font-amiri">
                  {settings.arabicSchoolName
                    ? settings.arabicSchoolName.slice(0, 30)
                    : 'الإتقان'}
                </span>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  {settings.currentSession} {settings.currentTerm && `\u2022 ${settings.currentTerm}`}
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight line-clamp-1">
                {settings.schoolName || 'Islamic School Management System'}
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* User Profile & Role Info */}
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-xs font-bold text-slate-100 line-clamp-1">
                {currentUser.fullName}
              </span>
              <div className="mt-0.5">{getRoleBadge()}</div>
            </div>

            {/* Logout Button */}
            <button
              onClick={() => {
                if (window.confirm(`Log out of ${currentUser.fullName}'s session?`)) {
                  onLogout();
                }
              }}
              className="bg-slate-800 hover:bg-red-900/80 hover:text-red-200 text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 hover:border-red-700 transition flex items-center space-x-1.5 shadow-sm"
              title="Sign Out of School Portal"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile User Tag */}
        <div className="md:hidden py-1.5 border-b border-slate-800/50 flex items-center justify-between text-xs text-slate-300">
          <span className="font-semibold text-white truncate max-w-[200px]">
            {currentUser.fullName}
          </span>
          <div>{getRoleBadge()}</div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 overflow-x-auto py-2 scrollbar-thin">
          {visibleNavItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-blue-800 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
