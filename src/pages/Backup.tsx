import { Download, Upload, AlertTriangle, CheckCircle, XCircle, SkipForward } from 'lucide-react';
import { useState, useRef } from 'react';
import {
  exportAllData,
  downloadExport,
  validateImportData,
  generateImportPreview,
  executeImport,
  parseImportFile,
} from '../lib/backup';
import { ExportData, ImportPreview, MergeLogEntry } from '../types';

export default function Backup() {
  const [exporting, setExporting] = useState(false);
  const [importData, setImportData] = useState<ExportData | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [deleteOrphans, setDeleteOrphans] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mergeLog, setMergeLog] = useState<MergeLogEntry[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportAllData();
      downloadExport(data);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset state
    setImportData(null);
    setImportPreview(null);
    setImportErrors([]);
    setMergeLog(null);

    try {
      const rawData = await parseImportFile(file);
      const validation = validateImportData(rawData);

      if (!validation.valid) {
        setImportErrors(validation.errors);
        return;
      }

      const data = rawData as ExportData;
      setImportData(data);

      // Generate preview
      const preview = await generateImportPreview(data, deleteOrphans);
      setImportPreview(preview);
    } catch (error) {
      setImportErrors([error instanceof Error ? error.message : 'Failed to read file']);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteOrphansChange = async (checked: boolean) => {
    setDeleteOrphans(checked);
    if (importData) {
      const preview = await generateImportPreview(importData, checked);
      setImportPreview(preview);
    }
  };

  const handleImport = async () => {
    if (!importData) return;

    setImporting(true);
    try {
      const log = await executeImport(importData, deleteOrphans);
      setMergeLog(log);
      setImportData(null);
      setImportPreview(null);
    } catch (error) {
      console.error('Import failed:', error);
      setImportErrors([error instanceof Error ? error.message : 'Import failed']);
    } finally {
      setImporting(false);
    }
  };

  const handleCancelImport = () => {
    setImportData(null);
    setImportPreview(null);
    setImportErrors([]);
  };

  const handleCloseMergeLog = () => {
    setMergeLog(null);
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Backup & Restore</h1>

      <div className="space-y-6">
        <p className="text-sm text-slate-600">
          Export your data for backup or import from another device. When importing, only records newer than your local data will be updated.
        </p>

        {/* Export Section */}
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg">
          <h4 className="font-semibold text-slate-900 mb-2">Export Data</h4>
          <p className="text-sm text-slate-600 mb-4">
            Download a JSON file containing all your jobs, systems, laborers, costs, and inventory.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Download size={18} />
            {exporting ? 'Exporting...' : 'Export Backup'}
          </button>
        </div>

        {/* Import Section */}
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg">
          <h4 className="font-semibold text-slate-900 mb-2">Import Data</h4>
          <p className="text-sm text-slate-600 mb-4">
            Import data from a backup file. You'll see a preview of changes before applying them.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!importPreview && !mergeLog && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors"
            >
              <Upload size={18} />
              Select Backup File
            </button>
          )}

          {/* Validation Errors */}
          {importErrors.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
                <AlertTriangle size={18} />
                Validation Errors
              </div>
              <ul className="text-sm text-red-600 list-disc list-inside max-h-48 overflow-y-auto">
                {importErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
              <button
                onClick={() => setImportErrors([])}
                className="mt-3 px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Import Preview */}
          {importPreview && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-4">
                <h5 className="font-semibold text-slate-900">Import Preview</h5>
                <p className="text-sm text-slate-500">
                  Exported: {importData?.metadata.exportedAt ? new Date(importData.metadata.exportedAt).toLocaleString() : 'Unknown'}
                </p>
              </div>

              {/* Delete orphans option */}
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteOrphans}
                  onChange={(e) => handleDeleteOrphansChange(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-900">
                  Delete local records not in import file (full sync)
                </span>
              </label>

              {/* Preview Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">{importPreview.toAdd.length}</p>
                  <p className="text-sm text-green-700">To Add</p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">{importPreview.toUpdate.length}</p>
                  <p className="text-sm text-blue-700">To Update</p>
                </div>
                <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-slate-600">{importPreview.toSkip.length}</p>
                  <p className="text-sm text-slate-700">To Skip</p>
                </div>
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600">{importPreview.toDelete.length}</p>
                  <p className="text-sm text-red-700">To Delete</p>
                </div>
              </div>

              {/* Detailed Preview */}
              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-200">
                {importPreview.toAdd.map((item, i) => (
                  <div key={`add-${i}`} className="flex items-center gap-3 p-3 bg-green-50">
                    <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                    <span className="text-sm">
                      <span className="font-medium text-green-700">Add</span>{' '}
                      <span className="text-slate-600">{item.entityType}:</span>{' '}
                      <span className="text-slate-900">{item.entityName}</span>
                    </span>
                  </div>
                ))}
                {importPreview.toUpdate.map((item, i) => (
                  <div key={`update-${i}`} className="flex items-center gap-3 p-3 bg-blue-50">
                    <CheckCircle size={16} className="text-blue-600 flex-shrink-0" />
                    <span className="text-sm">
                      <span className="font-medium text-blue-700">Update</span>{' '}
                      <span className="text-slate-600">{item.entityType}:</span>{' '}
                      <span className="text-slate-900">{item.entityName}</span>
                    </span>
                  </div>
                ))}
                {importPreview.toSkip.map((item, i) => (
                  <div key={`skip-${i}`} className="flex items-center gap-3 p-3">
                    <SkipForward size={16} className="text-slate-400 flex-shrink-0" />
                    <span className="text-sm">
                      <span className="font-medium text-slate-500">Skip</span>{' '}
                      <span className="text-slate-600">{item.entityType}:</span>{' '}
                      <span className="text-slate-900">{item.entityName}</span>
                      <span className="text-slate-400"> - {item.reason}</span>
                    </span>
                  </div>
                ))}
                {importPreview.toDelete.map((item, i) => (
                  <div key={`delete-${i}`} className="flex items-center gap-3 p-3 bg-red-50">
                    <XCircle size={16} className="text-red-600 flex-shrink-0" />
                    <span className="text-sm">
                      <span className="font-medium text-red-700">Delete</span>{' '}
                      <span className="text-slate-600">{item.entityType}:</span>{' '}
                      <span className="text-slate-900">{item.entityName}</span>
                    </span>
                  </div>
                ))}
                {importPreview.toAdd.length === 0 && importPreview.toUpdate.length === 0 &&
                 importPreview.toSkip.length === 0 && importPreview.toDelete.length === 0 && (
                  <div className="p-4 text-center text-slate-500">
                    No changes to apply
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleImport}
                  disabled={importing || (importPreview.toAdd.length === 0 && importPreview.toUpdate.length === 0 && importPreview.toDelete.length === 0)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {importing ? 'Importing...' : 'Apply Import'}
                </button>
                <button
                  onClick={handleCancelImport}
                  className="px-4 py-2 bg-slate-300 text-slate-900 rounded-lg font-semibold hover:bg-slate-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Merge Log */}
          {mergeLog && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-4">
                <h5 className="font-semibold text-slate-900">Import Complete</h5>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {mergeLog.filter(e => e.action === 'add').length}
                  </p>
                  <p className="text-sm text-green-700">Added</p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {mergeLog.filter(e => e.action === 'update').length}
                  </p>
                  <p className="text-sm text-blue-700">Updated</p>
                </div>
                <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-slate-600">
                    {mergeLog.filter(e => e.action === 'skip').length}
                  </p>
                  <p className="text-sm text-slate-700">Skipped</p>
                </div>
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {mergeLog.filter(e => e.action === 'delete').length}
                  </p>
                  <p className="text-sm text-red-700">Deleted</p>
                </div>
              </div>

              {/* Detailed Log */}
              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-200">
                {mergeLog.map((entry, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 ${
                      entry.action === 'add' ? 'bg-green-50' :
                      entry.action === 'update' ? 'bg-blue-50' :
                      entry.action === 'delete' ? 'bg-red-50' : ''
                    }`}
                  >
                    {entry.action === 'add' && <CheckCircle size={16} className="text-green-600 flex-shrink-0" />}
                    {entry.action === 'update' && <CheckCircle size={16} className="text-blue-600 flex-shrink-0" />}
                    {entry.action === 'skip' && <SkipForward size={16} className="text-slate-400 flex-shrink-0" />}
                    {entry.action === 'delete' && <XCircle size={16} className="text-red-600 flex-shrink-0" />}
                    <span className="text-sm">
                      <span className={`font-medium ${
                        entry.action === 'add' ? 'text-green-700' :
                        entry.action === 'update' ? 'text-blue-700' :
                        entry.action === 'delete' ? 'text-red-700' : 'text-slate-500'
                      }`}>
                        {entry.action.charAt(0).toUpperCase() + entry.action.slice(1)}
                      </span>{' '}
                      <span className="text-slate-600">{entry.entityType}:</span>{' '}
                      <span className="text-slate-900">{entry.entityName}</span>
                      <span className="text-slate-400"> - {entry.reason}</span>
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleCloseMergeLog}
                className="mt-4 px-4 py-2 bg-slate-300 text-slate-900 rounded-lg font-semibold hover:bg-slate-400 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
