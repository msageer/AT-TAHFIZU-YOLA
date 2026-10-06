import React, { useState } from 'react';
import { AppDatabase, SubjectItem } from '../types';
import { BookOpen, Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react';

interface SubjectsViewProps {
  db: AppDatabase;
  onUpdateSubjects: (subjects: SubjectItem[]) => void;
}

export const SubjectsView: React.FC<SubjectsViewProps> = ({ db, onUpdateSubjects }) => {
  const [newEnglishName, setNewEnglishName] = useState('');
  const [newArabicName, setNewArabicName] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEnglishName.trim()) return;

    const exists = db.subjects.some(
      s => s.name.toLowerCase() === newEnglishName.trim().toLowerCase()
    );
    if (exists) {
      showNotification(`Subject "${newEnglishName}" already exists!`);
      return;
    }

    const newSub: SubjectItem = {
      id: `sub-${Date.now()}`,
      name: newEnglishName.trim(),
      arabicName: newArabicName.trim() || newEnglishName.trim(),
      isActive: true,
    };

    onUpdateSubjects([...db.subjects, newSub]);
    setNewEnglishName('');
    setNewArabicName('');
    showNotification(`Subject "${newSub.name}" added successfully!`);
  };

  const handleToggleActive = (id: string) => {
    const updated = db.subjects.map(s => (s.id === id ? { ...s, isActive: !s.isActive } : s));
    onUpdateSubjects(updated);
  };

  const handleDelete = (id: string, name: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${name}"? Historical assessment records will remain safely intact.`
      )
    ) {
      return;
    }
    const updated = db.subjects.filter(s => s.id !== id);
    onUpdateSubjects(updated);
    showNotification(`Subject "${name}" deleted.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Curriculum Subjects &amp; Arabic Titles
          </h2>
          <p className="text-xs text-slate-500">
            Islamic Studies, Tahfiz, Arabic Language, and Core Academic Subjects configured for assessment entry.
          </p>
        </div>
      </div>

      {notification && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
          {notification}
        </div>
      )}

      {/* Add New Subject Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-1.5">
          <BookOpen className="w-4 h-4 text-emerald-600" />
          <span>Add New Subject</span>
        </h3>

        <form onSubmit={handleAddSubject} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              English Name *
            </label>
            <input
              type="text"
              required
              value={newEnglishName}
              onChange={e => setNewEnglishName(e.target.value)}
              placeholder="e.g. Hadith or Tajweed"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Arabic Title (المادة)
            </label>
            <input
              type="text"
              dir="rtl"
              value={newArabicName}
              onChange={e => setNewArabicName(e.target.value)}
              placeholder="e.g. الحديث النبوي أو التجويد"
              className="w-full text-sm font-amiri font-bold border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2.5 px-4 rounded-lg transition flex items-center justify-center space-x-1.5 shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Add Subject</span>
            </button>
          </div>
        </form>
      </div>

      {/* Subjects Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            All Curriculum Subjects ({db.subjects.length})
          </span>
          <span className="text-xs text-slate-500">
            {db.subjects.filter(s => s.isActive).length} active for new assessments
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Subject (English)</th>
                <th className="py-3 px-4 text-right">Arabic Name (المادة)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.subjects.map((sub, idx) => (
                <tr key={sub.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">{sub.name}</td>
                  <td className="py-3 px-4 font-amiri font-bold text-base text-right text-slate-900">
                    {sub.arabicName}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => handleToggleActive(sub.id)}
                      className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold transition ${
                        sub.isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {sub.isActive ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-slate-500" />
                          <span>Disabled</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDelete(sub.id, sub.name)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                      title="Delete subject"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
