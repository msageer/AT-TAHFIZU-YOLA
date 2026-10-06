import React from 'react';
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
} from 'lucide-react';
import { SchoolSettings, NavigationTab } from '../types';

export type { NavigationTab };

interface NavbarProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  settings: SchoolSettings;
  onOpenOnboarding: () => void;
  userRole: 'admin' | 'teacher';
  onToggleRole: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  settings,
  onOpenOnboarding,
  userRole,
  onToggleRole,
}) => {
  const navItems: Array<{ id: NavigationTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'classes', label: 'Classes', icon: GraduationCap },
    { id: 'assessment', label: 'Assessment', icon: ClipboardPenLine },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'class-summary', label: 'Class Summary', icon: TableProperties },
    { id: 'promotion', label: 'Promotion', icon: ArrowUpRight },
    { id: 'import-export', label: 'Import / Export', icon: FileSpreadsheet },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="bg-slate-900 text-white shadow-md border-b border-slate-800 no-print sticky top-0 z-40">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 border-b border-slate-800/80">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
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
                  {settings.arabicSchoolName ? settings.arabicSchoolName.slice(0, 30) : 'الإتقان'}
                </span>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  {settings.currentSession} &bull; {settings.currentTerm}
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight line-clamp-1">
                {settings.schoolName || 'Islamic School Management System'}
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Role switch toggle */}
            <button
              onClick={onToggleRole}
              title="Toggle view between Admin and Teacher"
              className={`hidden sm:flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition ${
                userRole === 'admin'
                  ? 'bg-blue-950/80 border-blue-700 text-blue-200'
                  : 'bg-amber-950/80 border-amber-700 text-amber-200'
              }`}
            >
              {userRole === 'admin' ? (
                <Shield className="w-3 h-3 text-blue-400" />
              ) : (
                <UserCheck className="w-3 h-3 text-amber-400" />
              )}
              <span className="capitalize">{userRole} Mode</span>
            </button>

            {/* Quick Setup Onboarding button */}
            <button
              onClick={onOpenOnboarding}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 shadow"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Setup / Onboard</span>
              <span className="sm:hidden">Setup</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 overflow-x-auto py-2 scrollbar-thin">
          {navItems.map(item => {
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
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
