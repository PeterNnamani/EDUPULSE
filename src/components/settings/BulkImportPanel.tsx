import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  Users,
  UserCog,
} from 'lucide-react';
import {
  downloadImportTemplate,
  downloadStaffCredentialsCsv,
  isSupportedImportFile,
  previewImportFile,
  runBulkImport,
  type BulkImportPreview,
  type BulkImportType,
  type StaffImportResult,
  type StudentImportResult,
} from '@/services/bulkImport';

interface BulkImportPanelProps {
  schoolId: string;
}

export default function BulkImportPanel({ schoolId }: BulkImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<BulkImportType>('students');
  const [preview, setPreview] = useState<BulkImportPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [studentResult, setStudentResult] = useState<StudentImportResult | null>(null);
  const [staffResult, setStaffResult] = useState<StaffImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = async (selected: File, type: BulkImportType) => {
    setLoadingPreview(true);
    try {
      const p = await previewImportFile(selected, type);
      setPreview(p);
      if (p.type !== 'unknown') setImportType(p.type);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read file');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleFile = async (selected: File | null) => {
    setFile(selected);
    setStudentResult(null);
    setStaffResult(null);
    setError(null);
    setPreview(null);

    if (!selected) return;
    if (!isSupportedImportFile(selected)) {
      setError('Unsupported file type. Use .xlsx, .xls, or .csv');
      return;
    }

    await loadPreview(selected, importType);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError(null);
    setStudentResult(null);
    setStaffResult(null);
    setProgress({ done: 0, total: preview?.totalRows ?? 0 });

    try {
      const result = await runBulkImport(schoolId, file, importType, (done, total) => {
        setProgress({ done, total });
      });

      if (importType === 'staff') {
        setStaffResult(result as StaffImportResult);
      } else {
        setStudentResult(result as StudentImportResult);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const validRows =
    importType === 'staff' ? preview?.staffCount : preview?.studentCount;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
      <h2 className="font-semibold mb-2">Data import</h2>
      <p className="text-sm text-secondary-text mb-6">
        Upload an Excel or CSV file to import students (with parent links and classes) or staff
        (PINs are generated for new staff only). Rows that match existing records are updated, not
        duplicated — matched by name, parent phone, or staff phone/email.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => downloadImportTemplate('students')}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Student template
        </button>
        <button
          type="button"
          onClick={() => downloadImportTemplate('staff')}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Staff template
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        {(
          [
            { id: 'students' as const, label: 'Students & parents', icon: Users },
            { id: 'staff' as const, label: 'Staff', icon: UserCog },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setImportType(id);
              if (file) void loadPreview(file, id);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-colors ${
              importType === id
                ? 'border-black dark:border-white bg-secondary-bg dark:bg-dark-card font-medium'
                : 'border-border dark:border-gray-700 text-secondary-text hover:bg-secondary-bg/60'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full border-2 border-dashed border-border dark:border-gray-700 rounded-2xl p-8 flex flex-col items-center gap-3 hover:bg-secondary-bg/40 dark:hover:bg-dark-card/40 transition-colors"
      >
        <div className="w-12 h-12 rounded-full bg-secondary-bg dark:bg-dark-card flex items-center justify-center">
          {loadingPreview ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Upload className="w-6 h-6" />
          )}
        </div>
        <div className="text-center">
          <p className="font-medium">
            {file ? file.name : 'Choose Excel or CSV file'}
          </p>
          <p className="text-xs text-secondary-text mt-1">
            Supports .xlsx, .xls, .csv — same layout as your school register export
          </p>
        </div>
      </button>

      {preview && (
        <div className="mt-6 p-4 rounded-xl bg-secondary-bg dark:bg-dark-card text-sm">
          <div className="flex items-center gap-2 mb-2">
            <FileSpreadsheet className="w-4 h-4" />
            <span className="font-medium">Sheet: {preview.sheetName}</span>
          </div>
          <p className="text-secondary-text">
            {preview.totalRows} rows · {validRows ?? 0} valid for{' '}
            {importType === 'staff' ? 'staff' : 'student'} import
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {importing && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-secondary-text mb-1">
            <span>Importing…</span>
            <span>
              {progress.done} / {progress.total}
            </span>
          </div>
          <div className="h-2 rounded-full bg-secondary-bg dark:bg-dark-card overflow-hidden">
            <div
              className="h-full bg-black dark:bg-white transition-all"
              style={{
                width: progress.total
                  ? `${Math.round((progress.done / progress.total) * 100)}%`
                  : '0%',
              }}
            />
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
          disabled={!file || !preview || importing || (validRows ?? 0) === 0}
          onClick={() => void handleImport()}
        >
          {importing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {importing ? 'Importing…' : 'Run import'}
        </button>
      </div>

      {studentResult && (
        <div className="mt-6 p-4 rounded-xl border border-border dark:border-gray-700 space-y-2">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium">
            <CheckCircle2 className="w-5 h-5" />
            Student import complete
          </div>
          <p className="text-sm">
            Created: <strong>{studentResult.created}</strong> · Updated:{' '}
            <strong>{studentResult.updated}</strong> · Skipped:{' '}
            <strong>{studentResult.skipped}</strong>
          </p>
          {studentResult.errors.length > 0 && (
            <div className="text-xs text-secondary-text max-h-32 overflow-y-auto">
              {studentResult.errors.slice(0, 10).map((e) => (
                <p key={`${e.rowIndex}-${e.message}`}>
                  Row {e.rowIndex}: {e.message}
                </p>
              ))}
              {studentResult.errors.length > 10 && (
                <p>…and {studentResult.errors.length - 10} more</p>
              )}
            </div>
          )}
        </div>
      )}

      {staffResult && (
        <div className="mt-6 p-4 rounded-xl border border-border dark:border-gray-700 space-y-3">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium">
            <CheckCircle2 className="w-5 h-5" />
            Staff import complete
          </div>
          <p className="text-sm">
            Created: <strong>{staffResult.created}</strong> · Updated:{' '}
            <strong>{staffResult.updated}</strong> · Skipped:{' '}
            <strong>{staffResult.skipped}</strong>
          </p>
          {staffResult.credentials.length > 0 && (
            <button
              type="button"
              className="btn-secondary text-sm flex items-center gap-2"
              onClick={() => downloadStaffCredentialsCsv(staffResult.credentials)}
            >
              <Download className="w-4 h-4" />
              Download staff IDs & PINs (CSV)
            </button>
          )}
          {staffResult.errors.length > 0 && (
            <div className="text-xs text-secondary-text max-h-32 overflow-y-auto">
              {staffResult.errors.slice(0, 10).map((e) => (
                <p key={`${e.rowIndex}-${e.message}`}>
                  Row {e.rowIndex}: {e.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
