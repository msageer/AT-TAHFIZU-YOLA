import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Cloud,
  RefreshCw,
  Search,
  X,
  ArrowRight,
  User,
} from 'lucide-react';
import { SchoolSettings, NavigationTab, UserAccount, Student } from '../types';
import { ConfirmModal } from './ConfirmModal';

export type { NavigationTab };

interface NavbarProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  settings: SchoolSettings;
  currentUser: UserAccount;
  onLogout: () => void;
  syncStatus?: 'synced' | 'syncing' | 'offline' | 'error';
  students?: Student[];
  onSelectStudent?: (student: Student, action?: 'profile' | 'assessment' | 'report') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  settings,
  currentUser,
  onLogout,
  syncStatus = 'synced',
  students = [],
  onSelectStudent,
}) => {
  const isSuperAdmin = currentUser.role === 'super_admin';
  const isTeacher = currentUser.role === 'teacher';
  const isStaff = currentUser.role === 'staff';
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Global Student Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter students based on query and teacher role constraints
  const matchingStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return (students || [])
      .filter(s => {
        if (isTeacher && currentUser.assignedClass && s.className !== currentUser.assignedClass) {
          return false;
        }
        if (isTeacher && currentUser.assignedSection && s.section !== currentUser.assignedSection) {
          return false;
        }
        const nameMatch = s.name.toLowerCase().includes(q);
        const admMatch = (s.admissionNumber || '').toLowerCase().includes(q);
        const idMatch = (s.studentId || '').toLowerCase().includes(q);
        return nameMatch || admMatch || idMatch;
      })
      .slice(0, 8);
  }, [searchQuery, students, isTeacher, currentUser]);

  // Click outside listener to close search results dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut listener ('/' or 'Cmd+K' to focus search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      } else if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectStudentItem = (
    student: Student,
    action: 'profile' | 'assessment' | 'report' = 'profile'
  ) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    if (onSelectStudent) {
      onSelectStudent(student, action);
    } else {
      setActiveTab('students');
    }
  };

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

          {/* Global Student Search Bar (Desktop & Tablet) */}
          <div className="flex-1 max-w-sm lg:max-w-md mx-3 relative hidden sm:block" ref={searchContainerRef}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => {
                  if (searchQuery.trim()) setIsSearchOpen(true);
                }}
                placeholder="Jump to student (name or admission no)..."
                className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl pl-8 pr-8 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-inner"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchOpen(false);
                  }}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
                  <kbd className="hidden lg:inline-block text-[10px] font-mono bg-slate-700/60 text-slate-400 px-1.5 py-0.5 rounded border border-slate-600/60">
                    /
                  </kbd>
                </div>
              )}
            </div>

            {/* Floating Dropdown Results */}
            {isSearchOpen && searchQuery.trim() && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl z-50 overflow-hidden text-slate-100 max-h-96 flex flex-col animate-in fade-in zoom-in-95">
                <div className="p-2.5 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between text-[11px] font-semibold text-slate-300">
                  <span className="flex items-center space-x-1.5">
                    <Search className="w-3 h-3 text-blue-400" />
                    <span>Quick Jump ({matchingStudents.length} {matchingStudents.length === 1 ? 'match' : 'matches'})</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Esc to close</span>
                </div>

                <div className="overflow-y-auto divide-y divide-slate-800/80 max-h-80">
                  {matchingStudents.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No students found matching "{searchQuery}".
                    </div>
                  ) : (
                    matchingStudents.map(student => (
                      <div
                        key={student.id || student.studentId}
                        className="p-2.5 hover:bg-slate-800 transition flex items-center justify-between gap-2 group cursor-pointer"
                        onClick={() => handleSelectStudentItem(student, 'profile')}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                            student.gender === 'Female' ? 'bg-pink-900/60 text-pink-300 border border-pink-700/50' : 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
                          }`}>
                            {student.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-white group-hover:text-blue-400 block truncate transition-colors">
                              {student.name}
                            </span>
                            <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                              <span className="font-mono text-emerald-400">{student.admissionNumber}</span>
                              <span>&bull;</span>
                              <span className="text-slate-300 font-semibold">{student.className} ({student.section})</span>
                            </div>
                          </div>
                        </div>

                        {/* Direct Jump Action Buttons */}
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectStudentItem(student, 'profile');
                            }}
                            className="px-2 py-1 bg-slate-800 hover:bg-blue-700 text-slate-200 hover:text-white rounded text-[10px] font-semibold border border-slate-700 hover:border-blue-600 transition"
                            title="Open Student Profile"
                          >
                            Profile
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectStudentItem(student, 'assessment');
                            }}
                            className="px-2 py-1 bg-slate-800 hover:bg-emerald-700 text-slate-200 hover:text-white rounded text-[10px] font-semibold border border-slate-700 hover:border-emerald-600 transition"
                            title="Enter Assessment Scores"
                          >
                            Marks
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectStudentItem(student, 'report');
                            }}
                            className="px-2 py-1 bg-slate-800 hover:bg-purple-700 text-slate-200 hover:text-white rounded text-[10px] font-semibold border border-slate-700 hover:border-purple-600 transition"
                            title="View Terminal Report Card"
                          >
                            Report
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Live Cloud Multi-Device Sync Indicator */}
            <div
              className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800/90 border border-slate-700/80 text-slate-300 shadow-xs"
              title="Real-time multi-device cloud synchronization across all devices and phones"
            >
              {syncStatus === 'syncing' ? (
                <>
                  <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                  <span className="text-amber-300">Syncing...</span>
                </>
              ) : syncStatus === 'offline' ? (
                <>
                  <Cloud className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-400">Offline Cache</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-300">Multi-Device Live Sync</span>
                </>
              )}
            </div>

            {/* User Profile & Role Info */}
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-xs font-bold text-slate-100 line-clamp-1">
                {currentUser.fullName}
              </span>
              <div className="mt-0.5">{getRoleBadge()}</div>
            </div>

            {/* Logout Button */}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="bg-slate-800 hover:bg-red-900/80 hover:text-red-200 text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 hover:border-red-700 transition flex items-center space-x-1.5 shadow-sm"
              title="Sign Out of School Portal"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile Search Bar & User Tag */}
        <div className="sm:hidden py-2 border-b border-slate-800/50 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              placeholder="Search student by name or admission no..."
              className="w-full bg-slate-800/90 border border-slate-700/80 rounded-lg pl-8 pr-8 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchOpen(false);
                }}
                className="absolute right-2.5 top-2 text-slate-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Dropdown Results */}
          {isSearchOpen && searchQuery.trim() && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-800">
              {matchingStudents.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400">
                  No students found matching "{searchQuery}".
                </div>
              ) : (
                matchingStudents.map(student => (
                  <div
                    key={student.id || student.studentId}
                    className="p-2.5 hover:bg-slate-800 flex items-center justify-between gap-2"
                    onClick={() => handleSelectStudentItem(student, 'profile')}
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block truncate">
                        {student.name}
                      </span>
                      <div className="text-[10px] text-slate-400 flex items-center space-x-1.5">
                        <span className="font-mono text-emerald-400">{student.admissionNumber}</span>
                        <span>&bull;</span>
                        <span>{student.className} ({student.section})</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-2 py-1 bg-blue-800 text-white rounded text-[10px] font-semibold flex-shrink-0"
                    >
                      View
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
            <span className="font-semibold text-white truncate max-w-[200px]">
              {currentUser.fullName}
            </span>
            <div>{getRoleBadge()}</div>
          </div>
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

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Sign Out of Portal"
        message={`Are you sure you want to sign out of ${currentUser.fullName}'s active session?`}
        confirmText="Yes, Sign Out"
        cancelText="Cancel"
        variant="warning"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          onLogout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </header>
  );
};
