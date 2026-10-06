import React, { useState, useRef } from 'react';
import { AppDatabase, Student, ClassItem, SectionItem } from '../types';
import {
  downloadStudentTemplate,
  parseRawSpreadsheet,
  autoDetectColumnMapping,
  detectNewClassesAndSections,
  validateMappedSpreadsheet,
  exportStudentsToExcel,
  exportAssessmentBroadsheetToExcel,
  exportAttendanceToExcel,
  TARGET_FIELDS,
  RawSpreadsheetData,
  ColumnMapping,
  FlexibleImportResult,
} from '../utils/excel';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle,
  AlertTriangle,
  Users,
  Database,
  CalendarCheck,
  Plus,
} from 'lucide-react';

interface ExcelManagerProps {
  db: AppDatabase;
  onImportStudents: (students: Student[]) => void;
  onAutoAddClasses: (newClasses: ClassItem[]) => void;
  onAutoAddSections: (newSections: SectionItem[]) => void;
}

export const ExcelManager: React.FC<ExcelManagerProps> = ({
  db,
  onImportStudents,
  onAutoAddClasses,
  onAutoAddSections,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawData, setRawData] = useState<RawSpreadsheetData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [detectedClasses, setDetectedClasses] = useState<string[]>([]);
  const [detectedSections, setDetectedSections] = useState<string[]>([]);
  const [validationResult, setValidationResult] = useState<FlexibleImportResult | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selected export options
  const [exportScope, setExportScope] = useState<'all' | 'class'>('all');
  const [selectedClassForExport, setSelectedClassForExport] = useState<string>(
    db.classes[0]?.name || 'Nursery One'
  );

  // Handle template download
  const handleDownloadTemplate = () => {
    downloadStudentTemplate(db.classes, db.sections);
  };

  // Handle spreadsheet file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setSuccessMessage(null);
    try {
      const parsed = await parseRawSpreadsheet(file);
      setRawData(parsed);

      const mapping = autoDetectColumnMapping(parsed.headers);
      setColumnMapping(mapping);

      const detected = detectNewClassesAndSections(
        parsed.rawRows,
        parsed.headers,
        mapping,
        db.classes,
        db.sections
      );
      setDetectedClasses(detected.newClasses);
      setDetectedSections(detected.newSections);

      const result = validateMappedSpreadsheet(
        parsed.rawRows,
        parsed.headers,
        mapping,
        db.students,
        db.classes,
        db.sections
      );
      setValidationResult(result);
    } catch (err: any) {
      alert(`Error reading spreadsheet: ${err.message || 'Invalid format'}`);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Re-map column
  const handleMappingChange = (header: string, targetKey: string) => {
    if (!rawData) return;
    const updated = { ...columnMapping, [header]: targetKey };
    setColumnMapping(updated);

    const detected = detectNewClassesAndSections(
      rawData.rawRows,
      rawData.headers,
      updated,
      db.classes,
      db.sections
    );
    setDetectedClasses(detected.newClasses);
    setDetectedSections(detected.newSections);

    const result = validateMappedSpreadsheet(
      rawData.rawRows,
      rawData.headers,
      updated,
      db.students,
      db.classes,
      db.sections
    );
    setValidationResult(result);
  };

  // Auto-add detected classes to DB
  const handleAddClasses = () => {
    const newItems: ClassItem[] = detectedClasses.map((cls, idx) => ({
      id: `cls-auto-${Date.now()}-${idx}`,
      name: cls,
      order: db.classes.length + idx + 1,
    }));
    onAutoAddClasses(newItems);
    setDetectedClasses([]);

    if (rawData) {
      const updatedClasses = [...db.classes, ...newItems];
      const result = validateMappedSpreadsheet(
        rawData.rawRows,
        rawData.headers,
        columnMapping,
        db.students,
        updatedClasses,
        db.sections
      );
      setValidationResult(result);
    }
  };

  // Auto-add detected sections to DB
  const handleAddSections = () => {
    const newItems: SectionItem[] = detectedSections.map((sec, idx) => ({
      id: `sec-auto-${Date.now()}-${idx}`,
      name: sec,
    }));
    onAutoAddSections(newItems);
    setDetectedSections([]);

    if (rawData) {
      const updatedSections = [...db.sections, ...newItems];
      const result = validateMappedSpreadsheet(
        rawData.rawRows,
        rawData.headers,
        columnMapping,
        db.students,
        db.classes,
        updatedSections
      );
      setValidationResult(result);
    }
  };

  // Confirm import of valid rows
  const handleConfirmImport = () => {
    if (!validationResult || validationResult.validStudents.length === 0) return;

    onImportStudents(validationResult.validStudents);
    setSuccessMessage(
      `Successfully imported ${validationResult.validStudents.length} student records into the database!`
    );
    setRawData(null);
    setValidationResult(null);
  };

  // Exports
  const handleExportStudents = () => {
    if (exportScope === 'all') {
      exportStudentsToExcel(db.students, 'All_Islamic_School_Students');
    } else {
      const classFiltered = db.students.filter(s => s.className === selectedClassForExport);
      exportStudentsToExcel(
        classFiltered,
        `${selectedClassForExport.replace(/\s+/g, '_')}_Students`
      );
    }
  };

  const handleExportAssessments = () => {
    const studentMap = db.students.reduce<Record<string, Student>>((acc, s) => {
      acc[s.studentId] = s;
      return acc;
    }, {});

    exportAssessmentBroadsheetToExcel(
      db.assessments,
      studentMap,
      'School_Master',
      'All_Arms',
      db.settings.currentSession,
      db.settings.currentTerm
    );
  };

  const handleExportAttendance = () => {
    const studentMap = db.students.reduce<Record<string, Student>>((acc, s) => {
      acc[s.studentId] = s;
      return acc;
    }, {});

    exportAttendanceToExcel(
      db.attendance || [],
      studentMap,
      db.settings.currentSession,
      db.settings.currentTerm
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Spreadsheet Import &amp; Export Center
        </h2>
        <p className="text-xs text-slate-500">
          Import student spreadsheets with intelligent column matching and auto-setup of classes, or export school records.
        </p>
      </div>

      {successMessage && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Grid: Import Section & Export Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT: SPREADSHEET IMPORT */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2.5 text-blue-900">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-800">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Upload Student Spreadsheet</h3>
              <p className="text-xs text-slate-500">Accepts .xlsx, .xls, .csv with automatic column matching</p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5">
            <div className="font-semibold text-slate-900">Flexible Header Detection:</div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Our system dynamically matches &quot;Name&quot;, &quot;Full Name&quot;, &quot;Adm No&quot;, &quot;Parent Phone&quot; and discovers your classes automatically.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={handleDownloadTemplate}
              className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-4 py-2.5 rounded-lg transition flex items-center justify-center space-x-1.5"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Download Excel Template</span>
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition flex items-center justify-center space-x-1.5 shadow"
            >
              <Upload className="w-4 h-4" />
              <span>{isProcessing ? 'Reading Spreadsheet...' : 'Upload Spreadsheet'}</span>
            </button>
          </div>
        </div>

        {/* RIGHT: SPREADSHEET EXPORTS */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2.5 text-emerald-900">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Export School Data to Excel</h3>
              <p className="text-xs text-slate-500">Download clean spreadsheets of students, marks, or attendance</p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Student Export Scope
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={exportScope}
                  onChange={e => setExportScope(e.target.value as any)}
                  className="text-xs border border-slate-300 rounded-lg p-2 bg-slate-50"
                >
                  <option value="all">All School Students ({db.students.length})</option>
                  <option value="class">Filter by Class</option>
                </select>

                {exportScope === 'class' && (
                  <select
                    value={selectedClassForExport}
                    onChange={e => setSelectedClassForExport(e.target.value)}
                    className="text-xs border border-slate-300 rounded-lg p-2 bg-white"
                  >
                    {db.classes.map(c => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                onClick={handleExportStudents}
                className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
              >
                <Users className="w-4 h-4" />
                <span>Export Students</span>
              </button>

              <button
                onClick={handleExportAssessments}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
              >
                <Database className="w-4 h-4" />
                <span>Export Broadsheet</span>
              </button>

              <button
                onClick={handleExportAttendance}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
              >
                <CalendarCheck className="w-4 h-4" />
                <span>Export Attendance</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* IMPORT MAPPING & VALIDATION RESULTS */}
      {rawData && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Uploaded File: {rawData.fileName}
              </h3>
              <p className="text-xs text-slate-500">
                Review column mapping and auto-create any detected classes/sections below.
              </p>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <button
                onClick={() => {
                  setRawData(null);
                  setValidationResult(null);
                }}
                className="text-slate-500 hover:text-slate-800 px-3 py-1 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={!validationResult || validationResult.validStudents.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg transition shadow flex items-center space-x-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>
                  Import {validationResult?.validStudents.length || 0} Valid Records
                </span>
              </button>
            </div>
          </div>

          {/* Detected Classes Banner */}
          {detectedClasses.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-bold text-amber-950">
                  Spreadsheet contains {detectedClasses.length} class(es) not currently in setup:
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {detectedClasses.map((c, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 font-semibold"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddClasses}
                className="bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold px-3 py-1.5 rounded transition shadow-sm whitespace-nowrap"
              >
                Auto-Create All Classes
              </button>
            </div>
          )}

          {/* Detected Sections Banner */}
          {detectedSections.length > 0 && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-bold text-blue-950">
                  Spreadsheet contains {detectedSections.length} section(s) not in setup:
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {detectedSections.map((s, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-blue-200 text-blue-950 font-semibold"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddSections}
                className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-3 py-1.5 rounded transition shadow-sm whitespace-nowrap"
              >
                Auto-Create All Sections
              </button>
            </div>
          )}

          {/* Column Mapping Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 p-2.5 border-b border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Spreadsheet Column &rarr; System Field Mapping</span>
              <span className="text-slate-500 font-normal">Adjust any field mapping below</span>
            </div>

            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase text-[10px]">
                  <tr>
                    <th className="p-2">Spreadsheet Column</th>
                    <th className="p-2">Mapped System Field</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rawData.headers.map((header, idx) => {
                    const mappedKey = columnMapping[header] || 'ignore';
                    const isMapped = mappedKey !== 'ignore';

                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 font-semibold text-slate-900">{header}</td>
                        <td className="p-2">
                          <select
                            value={mappedKey}
                            onChange={e => handleMappingChange(header, e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white font-medium"
                          >
                            <option value="ignore">-- Skip this column --</option>
                            {TARGET_FIELDS.map(f => (
                              <option key={f.key} value={f.key}>
                                {f.label} {f.required ? '(*)' : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 text-center">
                          {isMapped ? (
                            <span className="text-emerald-700 font-bold">&check; Mapped</span>
                          ) : (
                            <span className="text-slate-400">Ignored</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Validation Metrics */}
          {validationResult && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800">Total Rows: </span>
                  <span>{validationResult.totalRows}</span>
                  <span className="mx-2">&bull;</span>
                  <span className="font-bold text-emerald-700">Valid: </span>
                  <span>{validationResult.validStudents.length}</span>
                  <span className="mx-2">&bull;</span>
                  <span className="font-bold text-amber-700">Warnings: </span>
                  <span>{validationResult.warnings.length}</span>
                  <span className="mx-2">&bull;</span>
                  <span className="font-bold text-red-700">Errors: </span>
                  <span>{validationResult.errors.length}</span>
                </div>
              </div>

              {/* Errors list */}
              {validationResult.errors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-red-900">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>Errors Found ({validationResult.errors.length} rows will be skipped):</span>
                  </div>
                  <ul className="text-red-800 pl-5 list-disc space-y-0.5 max-h-32 overflow-y-auto">
                    {validationResult.errors.map((err, i) => (
                      <li key={i}>
                        <strong>Row {err.row} [{err.field}]:</strong> {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Valid Students Preview */}
              {validationResult.validStudents.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="p-2">Student ID</th>
                        <th className="p-2">Name</th>
                        <th className="p-2">Class</th>
                        <th className="p-2">Section</th>
                        <th className="p-2">Gender</th>
                        <th className="p-2">Parent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {validationResult.validStudents.slice(0, 10).map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-mono font-bold text-slate-900">{s.studentId}</td>
                          <td className="p-2 font-semibold text-slate-900">{s.name}</td>
                          <td className="p-2 text-slate-700">{s.className}</td>
                          <td className="p-2 text-slate-700">{s.section}</td>
                          <td className="p-2 text-slate-700">{s.gender}</td>
                          <td className="p-2 text-slate-700">{s.parentName || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
