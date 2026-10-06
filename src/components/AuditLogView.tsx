import React, { useState } from 'react';
import { AuditLogEntry, UserAccount } from '../types';
import { ConfirmModal } from './ConfirmModal';
import {
  ShieldAlert,
  Search,
  Filter,
  Download,
  Trash2,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

interface AuditLogViewProps {
  logs: AuditLogEntry[];
  currentUser: UserAccount;
  onClearLogs?: () => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({
  logs = [],
  currentUser,
  onClearLogs,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterRole, setFilterRole] = useState('ALL');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filteredLogs = logs.filter(log => {
    if (filterRole !== 'ALL' && log.userRole !== filterRole) return false;
    if (filterAction !== 'ALL' && log.action !== filterAction) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match =
        log.userName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const getActionBadge = (action: string) => {
    if (action.includes('LOGIN')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
    if (action.includes('LOGOUT')) {
      return 'bg-slate-100 text-slate-700 border-slate-300';
    }
    if (action.includes('DELETE')) {
      return 'bg-red-100 text-red-800 border-red-300';
    }
    if (action.includes('USER')) {
      return 'bg-purple-100 text-purple-800 border-purple-300';
    }
    if (action.includes('ASSESSMENT')) {
      return 'bg-blue-100 text-blue-800 border-blue-300';
    }
    if (action.includes('ATTENDANCE')) {
      return 'bg-amber-100 text-amber-800 border-amber-300';
    }
    return 'bg-indigo-100 text-indigo-800 border-indigo-300';
  };

  const exportLogsAsCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['Timestamp', 'User Name', 'Role', 'Action', 'Details'];
    const rows = filteredLogs.map(l => [
      `"${new Date(l.timestamp).toLocaleString()}"`,
      `"${l.userName.replace(/"/g, '""')}"`,
      `"${l.userRole}"`,
      `"${l.action}"`,
      `"${l.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-blue-100 text-blue-800 rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900">Security &amp; Activity Audit Log</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time chronological trace of school logins, student records, mark entries, and administrative alterations.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={exportLogsAsCSV}
            disabled={filteredLogs.length === 0}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition shadow-sm flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          {currentUser.role === 'super_admin' && onClearLogs && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-xs rounded-lg transition flex items-center space-x-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Trail</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Activity Entries
          </span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{logs.length}</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Login &amp; Auth Events
          </span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">
            {logs.filter(l => l.action.includes('LOGIN')).length}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Assessment Operations
          </span>
          <span className="text-2xl font-black text-blue-600 mt-1 block">
            {logs.filter(l => l.action.includes('ASSESSMENT')).length}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Admin Modifications
          </span>
          <span className="text-2xl font-black text-purple-600 mt-1 block">
            {logs.filter(l => l.userRole === 'super_admin').length}
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by user name, action, or details..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center space-x-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Role:</span>
          </div>
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg p-2 bg-white"
          >
            <option value="ALL">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="staff">Staff</option>
            <option value="teacher">Teacher</option>
          </select>

          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg p-2 bg-white"
          >
            <option value="ALL">All Actions</option>
            <option value="USER_LOGIN">User Logins</option>
            <option value="USER_LOGOUT">User Logouts</option>
            <option value="CREATE_USER">Create User</option>
            <option value="SAVE_STUDENT">Save Student</option>
            <option value="SAVE_ASSESSMENT">Assessment Entries</option>
            <option value="SAVE_ATTENDANCE">Attendance Entries</option>
            <option value="PROMOTE_STUDENTS">Promotions</option>
            <option value="IMPORT_STUDENTS">Import Excel</option>
            <option value="UPDATE_SETTINGS">School Settings</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                    No activity logs found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {log.userName}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          log.userRole === 'super_admin'
                            ? 'bg-purple-100 text-purple-800'
                            : log.userRole === 'teacher'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {log.userRole.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-md break-words">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="Clear Audit Trail"
        message="Are you sure you want to clear historical audit logs? This action will permanently remove previous activity records."
        variant="danger"
        confirmText="Yes, Clear Audit Trail"
        cancelText="Cancel"
        onConfirm={() => {
          setShowClearConfirm(false);
          onClearLogs?.();
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
};
