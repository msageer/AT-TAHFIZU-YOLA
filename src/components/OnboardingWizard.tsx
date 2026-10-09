import React, { useState, useRef } from 'react';
import { SchoolSettings, ClassItem, SectionItem, Student, AppDatabase } from '../types';
import {
  parseRawSpreadsheet,
  autoDetectColumnMapping,
  detectNewClassesAndSections,
  validateMappedSpreadsheet,
  downloadStudentTemplate,
  TARGET_FIELDS,
  RawSpreadsheetData,
  ColumnMapping,
  FlexibleImportResult,
} from '../utils/excel';
import {
  Building2,
  Image,
  FileSpreadsheet,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Upload,
  Download,
  AlertTriangle,
  X,
  Sparkles,
  Layers,
} from 'lucide-react';

interface OnboardingWizardProps {
  db: AppDatabase;
  onCompleteOnboarding: (data: {
    settings: SchoolSettings;
    newClasses: ClassItem[];
    newSections: SectionItem[];
    importedStudents: Student[];
  }) => void;
  onClose: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  db,
  onCompleteOnboarding,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: School Profile
  const [settings, setSettings] = useState<SchoolSettings>({
    ...db.settings,
    schoolName: db.settings.schoolName || '',
    arabicSchoolName: db.settings.arabicSchoolName || '',
    motto: db.settings.motto || 'شعارنا: خيركم من تعلم القرآن وعلمه',
    address: db.settings.address || '',
    telephone: db.settings.telephone || '',
    email: db.settings.email || '',
    currentSession: db.settings.currentSession || '2026/2027',
  });

  // Step 2: Logo
  const logoInputRef = useRef<HTMLInputElement>(null);
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setSettings(prev => ({ ...prev, logoUrl: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // Step 3: Spreadsheet Upload & Mapping
  const spreadsheetInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawData, setRawData] = useState<RawSpreadsheetData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [detectedClasses, setDetectedClasses] = useState<string[]>([]);
  const [detectedSections, setDetectedSections] = useState<string[]>([]);
  const [validationResult, setValidationResult] = useState<FlexibleImportResult | null>(null);

  // Classes & Sections to potentially auto-create
  const [createdClasses, setCreatedClasses] = useState<ClassItem[]>([...db.classes]);
  const [createdSections, setCreatedSections] = useState<SectionItem[]>([...db.sections]);

  // Handle spreadsheet file upload
  const handleSpreadsheetFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const parsed = await parseRawSpreadsheet(file);
      setRawData(parsed);

      // Auto-detect column mapping
      const mapping = autoDetectColumnMapping(parsed.headers);
      setColumnMapping(mapping);

      // Auto-detect classes and sections
      const detected = detectNewClassesAndSections(
        parsed.rawRows,
        parsed.headers,
        mapping,
        createdClasses,
        createdSections
      );
      setDetectedClasses(detected.newClasses);
      setDetectedSections(detected.newSections);

      // Run initial validation
      const result = validateMappedSpreadsheet(
        parsed.rawRows,
        parsed.headers,
        mapping,
        db.students,
        createdClasses,
        createdSections
      );
      setValidationResult(result);
    } catch (err: any) {
      alert(`Error reading spreadsheet: ${err.message || 'Invalid file format'}`);
    } finally {
      setIsProcessing(false);
      if (spreadsheetInputRef.current) spreadsheetInputRef.current.value = '';
    }
  };

  // Re-validate when column mapping changes
  const handleMappingChange = (header: string, targetKey: string) => {
    if (!rawData) return;
    const updated = { ...columnMapping, [header]: targetKey };
    setColumnMapping(updated);

    const detected = detectNewClassesAndSections(
      rawData.rawRows,
      rawData.headers,
      updated,
      createdClasses,
      createdSections
    );
    setDetectedClasses(detected.newClasses);
    setDetectedSections(detected.newSections);

    const result = validateMappedSpreadsheet(
      rawData.rawRows,
      rawData.headers,
      updated,
      db.students,
      createdClasses,
      createdSections
    );
    setValidationResult(result);
  };

  // Auto-add all detected classes into setup
  const handleAddAllDetectedClasses = () => {
    const newItems: ClassItem[] = detectedClasses.map((cls, idx) => ({
      id: `cls-auto-${Date.now()}-${idx}`,
      name: cls,
      order: createdClasses.length + idx + 1,
    }));
    const updated = [...createdClasses, ...newItems];
    setCreatedClasses(updated);
    setDetectedClasses([]);

    if (rawData) {
      const result = validateMappedSpreadsheet(
        rawData.rawRows,
        rawData.headers,
        columnMapping,
        db.students,
        updated,
        createdSections
      );
      setValidationResult(result);
    }
  };

  // Auto-add all detected sections into setup
  const handleAddAllDetectedSections = () => {
    const newItems: SectionItem[] = detectedSections.map((sec, idx) => ({
      id: `sec-auto-${Date.now()}-${idx}`,
      name: sec,
    }));
    const updated = [...createdSections, ...newItems];
    setCreatedSections(updated);
    setDetectedSections([]);

    if (rawData) {
      const result = validateMappedSpreadsheet(
        rawData.rawRows,
        rawData.headers,
        columnMapping,
        db.students,
        createdClasses,
        updated
      );
      setValidationResult(result);
    }
  };

  // Final Complete
  const handleFinish = () => {
    const validStudents = validationResult ? validationResult.validStudents : [];
    onCompleteOnboarding({
      settings: { ...settings, isSetupComplete: true },
      newClasses: createdClasses,
      newSections: createdSections,
      importedStudents: validStudents,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 sm:p-8 relative max-h-[94vh] flex flex-col animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 text-slate-400 hover:text-slate-700 p-1 rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Wizard Stepper Header */}
        <div className="border-b border-slate-200 pb-5 mb-5">
          <div className="flex items-center space-x-2 text-emerald-700 font-semibold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Fast School Onboarding Setup</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Welcome to the Islamic School Management System
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Set up your school in 3 simple steps or bring in your existing student spreadsheet.
          </p>

          {/* Stepper Progress */}
          <div className="flex items-center justify-between mt-5 max-w-lg">
            <div className="flex items-center space-x-2">
              <span
                className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${
                  currentStep >= 1
                    ? 'bg-blue-800 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                1
              </span>
              <span className="text-xs font-semibold text-slate-800">School Profile</span>
            </div>
            <div className={`h-0.5 w-12 sm:w-16 ${currentStep >= 2 ? 'bg-blue-800' : 'bg-slate-200'}`} />

            <div className="flex items-center space-x-2">
              <span
                className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${
                  currentStep >= 2
                    ? 'bg-blue-800 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                2
              </span>
              <span className="text-xs font-semibold text-slate-800">School Logo</span>
            </div>
            <div className={`h-0.5 w-12 sm:w-16 ${currentStep >= 3 ? 'bg-blue-800' : 'bg-slate-200'}`} />

            <div className="flex items-center space-x-2">
              <span
                className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${
                  currentStep >= 3
                    ? 'bg-blue-800 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                3
              </span>
              <span className="text-xs font-semibold text-slate-800">Upload Students</span>
            </div>
          </div>
        </div>

        {/* Scrollable Wizard Body */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {/* STEP 1: SCHOOL INFO */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 flex items-start space-x-2">
                <Building2 className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
                <span>
                  Enter your school details. These will automatically appear on all student report sheets and official school records.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    School Name (English) *
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.schoolName}
                    onChange={e => setSettings({ ...settings, schoolName: e.target.value })}
                    className="w-full text-sm font-semibold border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-600"
                    placeholder="e.g. AT-TAHFIZU WAL ITQAN ISLAMIYYA, YOLA"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Arabic School Name (الاسم بالعربية)
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={settings.arabicSchoolName}
                    onChange={e => setSettings({ ...settings, arabicSchoolName: e.target.value })}
                    className="w-full text-base font-amiri font-bold border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-emerald-600"
                    placeholder="مدرسة التحفيظ والإتقان الإسلامية، يولا"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Motto (الشعار)
                  </label>
                  <input
                    type="text"
                    value={settings.motto}
                    onChange={e => setSettings({ ...settings, motto: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                    placeholder="شعارنا: خيركم من تعلم القرآن وعلمه"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Academic Session
                  </label>
                  <input
                    type="text"
                    value={settings.currentSession}
                    onChange={e => setSettings({ ...settings, currentSession: e.target.value })}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2"
                    placeholder="2026/2027"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    School Address
                  </label>
                  <input
                    type="text"
                    value={settings.address}
                    onChange={e => setSettings({ ...settings, address: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                    placeholder="Along Bypass Road, beside Bole Street Junction, Lamido Zubairu Way, Yola Town"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Telephone Number(s)
                  </label>
                  <input
                    type="text"
                    value={settings.telephone}
                    onChange={e => setSettings({ ...settings, telephone: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                    placeholder="08033408522, 08058715879"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={settings.email}
                    onChange={e => setSettings({ ...settings, email: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                    placeholder="attahfizul.itqan@gmail.com"
                  />
                </div>

                {/* Head Teacher / Headmaster Name setting */}
                <div className="sm:col-span-2 bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 space-y-2">
                  <label className="block text-xs font-bold text-purple-900 uppercase mb-1">
                    Head Teacher / Headmaster Name (Appears on Student Report Sheets)
                  </label>
                  <input
                    type="text"
                    value={settings.headTeacherName || ''}
                    onChange={e => setSettings({ ...settings, headTeacherName: e.target.value })}
                    className="w-full text-xs font-semibold border border-purple-300 rounded-lg p-2.5 bg-white focus:ring-1 focus:ring-purple-600"
                    placeholder="e.g. Ustaz Al-Amin Kaigama"
                  />
                  <p className="text-[11px] text-purple-700">
                    This Headmaster name will be printed with stamp/signature at the bottom of all student term report sheets.
                  </p>
                </div>

                {/* Class / Form Teachers Assignment */}
                <div className="sm:col-span-2 bg-blue-50/50 border border-blue-200 rounded-xl p-3.5 space-y-2">
                  <span className="text-xs font-bold text-blue-900 uppercase block">
                    Class / Form Teachers (Report Sheets)
                  </span>
                  <p className="text-[11px] text-blue-700">
                    Assign a form teacher to each class. Their name will appear on student term report sheets alongside the Headmaster name.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {createdClasses.map(cls => (
                      <div key={cls.id} className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 text-xs">
                        <span className="font-semibold text-slate-800 w-28 truncate">{cls.name}:</span>
                        <input
                          type="text"
                          value={cls.classTeacherName || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setCreatedClasses(prev => prev.map(c => c.id === cls.id ? { ...c, classTeacherName: val } : c));
                          }}
                          placeholder="e.g. Mal. Ibrahim"
                          className="flex-1 text-xs border border-slate-300 rounded px-2 py-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: LOGO */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in text-center">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 flex items-start space-x-2 text-left">
                <Image className="w-4 h-4 text-emerald-700 mt-0.5 flex-shrink-0" />
                <span>
                  Upload your school emblem/logo. It will appear on report cards, summary sheets, and watermarks automatically.
                </span>
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center bg-slate-50/70">
                <div className="w-32 h-32 bg-white rounded-xl shadow-inner border border-slate-200 flex items-center justify-center p-2 mb-4">
                  {settings.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      alt="School Logo"
                      className="max-h-28 max-w-28 object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">No logo chosen</span>
                  )}
                </div>

                <input
                  type="file"
                  ref={logoInputRef}
                  onChange={handleLogoUpload}
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition flex items-center space-x-1.5 shadow"
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose Logo from Computer (PNG, JPG)</span>
                </button>
                <p className="text-[11px] text-slate-500 mt-2">
                  Accepts PNG, JPG, or JPEG. You can also change this anytime later in Settings.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: UPLOAD SPREADSHEET & AUTO-SETUP */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Upload Your Student Spreadsheet (.xlsx, .xls, .csv)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Our system adapts to your column headers and auto-detects your school classes.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => downloadStudentTemplate(createdClasses, createdSections)}
                    className="text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg transition flex items-center space-x-1"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Download Template</span>
                  </button>

                  <input
                    type="file"
                    ref={spreadsheetInputRef}
                    onChange={handleSpreadsheetFile}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => spreadsheetInputRef.current?.click()}
                    className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isProcessing ? 'Reading Sheet...' : 'Select Spreadsheet'}</span>
                  </button>
                </div>
              </div>

              {/* If no sheet uploaded yet */}
              {!rawData && (
                <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center space-y-2">
                  <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">
                    No spreadsheet selected yet.
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    You can upload an Excel or CSV file now, or skip this step to explore the system with our sample students and add them later.
                  </p>
                </div>
              )}

              {/* If sheet uploaded: Display Column Mapping & Auto-Detected Classes */}
              {rawData && (
                <div className="space-y-4">
                  {/* File info pill */}
                  <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 font-medium">
                    <span className="flex items-center space-x-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>
                        File: <strong>{rawData.fileName}</strong> ({rawData.rawRows.length} student rows)
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRawData(null);
                        setValidationResult(null);
                      }}
                      className="text-red-700 hover:underline font-bold"
                    >
                      Clear File
                    </button>
                  </div>

                  {/* Auto-detected new classes banner */}
                  {detectedClasses.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-bold text-amber-900">
                          Detected {detectedClasses.length} new class(es) in spreadsheet:
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {detectedClasses.map((c, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddAllDetectedClasses}
                        className="bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold px-3 py-1.5 rounded transition shadow-sm whitespace-nowrap self-start sm:self-center"
                      >
                        Auto-Create All Classes
                      </button>
                    </div>
                  )}

                  {/* Auto-detected new sections banner */}
                  {detectedSections.length > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-bold text-blue-900">
                          Detected {detectedSections.length} new section(s) in spreadsheet:
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {detectedSections.map((s, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-semibold"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddAllDetectedSections}
                        className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-3 py-1.5 rounded transition shadow-sm whitespace-nowrap self-start sm:self-center"
                      >
                        Auto-Create All Sections
                      </button>
                    </div>
                  )}

                  {/* Column Mapping Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 p-2.5 border-b border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>Column Header Mapping</span>
                      <span className="text-slate-500 font-normal">
                        Matches your file headers to system fields
                      </span>
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

                  {/* Validation Summary Bar */}
                  {validationResult && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
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

                      <span className="text-[11px] text-slate-500">
                        {validationResult.errors.length === 0
                          ? 'Ready to import perfectly!'
                          : 'Rows with errors will be skipped.'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation */}
        <div className="border-t border-slate-200 pt-4 mt-4 flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((currentStep - 1) as any)}
                className="text-xs font-semibold px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-100 transition flex items-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous Step</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 1 && !settings.schoolName.trim()) {
                    alert('Please enter your School Name before proceeding.');
                    return;
                  }
                  setCurrentStep((currentStep + 1) as any);
                }}
                className="bg-blue-800 hover:bg-blue-900 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition flex items-center space-x-1.5 shadow"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-6 py-2.5 rounded-lg transition flex items-center space-x-1.5 shadow"
              >
                <CheckCircle className="w-4 h-4" />
                <span>
                  {validationResult && validationResult.validStudents.length > 0
                    ? `Import ${validationResult.validStudents.length} Students & Finish`
                    : 'Complete School Setup'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
