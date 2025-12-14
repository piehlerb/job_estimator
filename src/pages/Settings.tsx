import { ArrowLeft, Plus, Trash2, Edit2, Download, Upload, AlertTriangle, CheckCircle, XCircle, SkipForward, Cloud, CloudOff } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import {
  getAllSystems,
  addSystem,
  updateSystem,
  deleteSystem,
  getCosts,
  saveCosts,
  getDefaultCosts,
  getAllLaborers,
  addLaborer,
  updateLaborer,
  deleteLaborer,
  getGoogleDriveAuth,
  saveGoogleDriveAuth,
  deleteGoogleDriveAuth,
  getGoogleDriveSettings,
  saveGoogleDriveSettings,
  getDefaultGoogleDriveSettings,
} from '../lib/db';
import {
  exportAllData,
  downloadExport,
  validateImportData,
  generateImportPreview,
  executeImport,
  parseImportFile,
} from '../lib/backup';
import { ChipSystem, ChipSize, Costs, Laborer, ExportData, ImportPreview, MergeLogEntry, GoogleDriveAuth, GoogleDriveSettings } from '../types';
import {
  initGoogleDrive,
  requestGoogleAuth,
  revokeGoogleAuth,
  setAuthToken,
  isAuthExpired,
  getUserEmail,
  setGoogleCredentials,
  hasCredentials,
} from '../lib/googleDrive';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

interface SettingsProps {
  onBack: () => void;
}

export default function Settings({ onBack }: SettingsProps) {
  const [tab, setTab] = useState<'systems' | 'costs' | 'laborers' | 'backup' | 'drive'>('systems');
  const [systems, setSystems] = useState<ChipSystem[]>([]);
  const [costs, setCosts] = useState<Costs>(getDefaultCosts());
  const [laborers, setLaborers] = useState<Laborer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSystemForm, setShowSystemForm] = useState(false);
  const [showLaborerForm, setShowLaborerForm] = useState(false);
  const [editingSystem, setEditingSystem] = useState<ChipSystem | null>(null);
  const [editingLaborer, setEditingLaborer] = useState<Laborer | null>(null);
  const [costsSaving, setCostsSaving] = useState(false);

  // Backup state
  const [exporting, setExporting] = useState(false);
  const [importData, setImportData] = useState<ExportData | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [deleteOrphans, setDeleteOrphans] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mergeLog, setMergeLog] = useState<MergeLogEntry[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google Drive state
  const [driveAuth, setDriveAuth] = useState<GoogleDriveAuth | null>(null);
  const [driveSettings, setDriveSettings] = useState<GoogleDriveSettings>(getDefaultGoogleDriveSettings());
  const [driveAuthenticating, setDriveAuthenticating] = useState(false);
  const [driveInitialized, setDriveInitialized] = useState(false);

  const [systemForm, setSystemForm] = useState({
    name: '',
    chipSize: '1/4' as ChipSize,
    feetPerLb: '',
    boxCost: '',
    baseSpread: '',
    topSpread: '',
  });

  const [costsForm, setCostsForm] = useState({
    baseCostPerGal: '',
    topCostPerGal: '',
    crackFillCost: '',
    gasCost: '',
    consumablesCost: '',
  });

  const [laborerForm, setLaborerForm] = useState({
    name: '',
    fullyLoadedRate: '',
    isActive: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const allSystems = await getAllSystems();
    const storedCosts = await getCosts();
    const allLaborers = await getAllLaborers();
    const auth = await getGoogleDriveAuth();
    const settings = await getGoogleDriveSettings();

    setSystems(allSystems);
    setLaborers(allLaborers);
    setDriveAuth(auth);

    if (storedCosts) {
      setCosts(storedCosts);
      setCostsForm({
        baseCostPerGal: storedCosts.baseCostPerGal.toString(),
        topCostPerGal: storedCosts.topCostPerGal.toString(),
        crackFillCost: storedCosts.crackFillCost.toString(),
        gasCost: storedCosts.gasCost.toString(),
        consumablesCost: storedCosts.consumablesCost.toString(),
      });
    }

    if (settings) {
      setDriveSettings(settings);

      // Set credentials if they exist in settings
      if (settings.clientId && settings.apiKey) {
        setGoogleCredentials(settings.clientId, settings.apiKey);
      }
    }

    // Initialize Google Drive API if credentials are configured
    if (hasCredentials()) {
      try {
        await initGoogleDrive();
        setDriveInitialized(true);

        // Set auth token if available and not expired
        if (auth && !isAuthExpired(auth)) {
          setAuthToken(auth);
        }
      } catch (error) {
        console.error('Failed to initialize Google Drive:', error);
      }
    }

    setLoading(false);
  };

  const handleSaveSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!systemForm.name.trim()) return;

    try {
      const system: ChipSystem = {
        id: editingSystem?.id || generateId(),
        name: systemForm.name,
        chipSize: systemForm.chipSize,
        feetPerLb: parseFloat(systemForm.feetPerLb) || 0,
        boxCost: parseFloat(systemForm.boxCost) || 0,
        baseSpread: parseFloat(systemForm.baseSpread) || 0,
        topSpread: parseFloat(systemForm.topSpread) || 0,
        createdAt: editingSystem?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (editingSystem) {
        await updateSystem(system);
      } else {
        await addSystem(system);
      }

      await loadData();
      setShowSystemForm(false);
      setEditingSystem(null);
      setSystemForm({ name: '', chipSize: '1/4', feetPerLb: '', boxCost: '', baseSpread: '', topSpread: '' });
    } catch (error) {
      console.error('Error saving system:', error);
    }
  };

  const handleSaveCosts = async (e: React.FormEvent) => {
    e.preventDefault();
    setCostsSaving(true);

    try {
      const updatedCosts: Costs = {
        ...costs,
        baseCostPerGal: parseFloat(costsForm.baseCostPerGal) || 0,
        topCostPerGal: parseFloat(costsForm.topCostPerGal) || 0,
        crackFillCost: parseFloat(costsForm.crackFillCost) || 0,
        gasCost: parseFloat(costsForm.gasCost) || 0,
        consumablesCost: parseFloat(costsForm.consumablesCost) || 0,
        updatedAt: new Date().toISOString(),
      };

      await saveCosts(updatedCosts);
      setCosts(updatedCosts);
    } catch (error) {
      console.error('Error saving costs:', error);
    } finally {
      setCostsSaving(false);
    }
  };

  const handleSaveLaborer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!laborerForm.name.trim()) return;

    try {
      const laborer: Laborer = {
        id: editingLaborer?.id || generateId(),
        name: laborerForm.name,
        fullyLoadedRate: parseFloat(laborerForm.fullyLoadedRate) || 0,
        isActive: laborerForm.isActive,
        createdAt: editingLaborer?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (editingLaborer) {
        await updateLaborer(laborer);
      } else {
        await addLaborer(laborer);
      }

      await loadData();
      setShowLaborerForm(false);
      setEditingLaborer(null);
      setLaborerForm({ name: '', fullyLoadedRate: '', isActive: true });
    } catch (error) {
      console.error('Error saving laborer:', error);
    }
  };

  const handleEditSystem = (system: ChipSystem) => {
    setEditingSystem(system);
    setSystemForm({
      name: system.name,
      chipSize: system.chipSize,
      feetPerLb: system.feetPerLb.toString(),
      boxCost: system.boxCost.toString(),
      baseSpread: system.baseSpread.toString(),
      topSpread: system.topSpread.toString(),
    });
    setShowSystemForm(true);
  };

  const handleEditLaborer = (laborer: Laborer) => {
    setEditingLaborer(laborer);
    setLaborerForm({
      name: laborer.name,
      fullyLoadedRate: laborer.fullyLoadedRate.toString(),
      isActive: laborer.isActive,
    });
    setShowLaborerForm(true);
  };

  const handleToggleLaborerActive = async (laborer: Laborer) => {
    const updated = { ...laborer, isActive: !laborer.isActive, updatedAt: new Date().toISOString() };
    await updateLaborer(updated);
    await loadData();
  };

  // Google Drive handlers
  const handleConnectDrive = async () => {
    setDriveAuthenticating(true);
    try {
      if (!driveInitialized) {
        await initGoogleDrive();
        setDriveInitialized(true);
      }

      const auth = await requestGoogleAuth();

      // Get user email
      const email = await getUserEmail();
      auth.userEmail = email;

      await saveGoogleDriveAuth(auth);
      setDriveAuth(auth);

      alert('Successfully connected to Google Drive!');
    } catch (error) {
      console.error('Failed to connect to Google Drive:', error);
      alert('Failed to connect to Google Drive. Please check your configuration and try again.');
    } finally {
      setDriveAuthenticating(false);
    }
  };

  const handleDisconnectDrive = async () => {
    if (!confirm('Are you sure you want to disconnect Google Drive? Photos already uploaded will remain in Drive, but new photos will not be uploaded.')) {
      return;
    }

    try {
      if (driveAuth) {
        await revokeGoogleAuth(driveAuth);
      }
      await deleteGoogleDriveAuth();
      setDriveAuth(null);
      alert('Successfully disconnected from Google Drive');
    } catch (error) {
      console.error('Failed to disconnect from Google Drive:', error);
      alert('Failed to disconnect. Please try again.');
    }
  };

  const handleSaveDriveSettings = async () => {
    try {
      await saveGoogleDriveSettings(driveSettings);

      // Update credentials if Client ID is provided
      if (driveSettings.clientId) {
        setGoogleCredentials(driveSettings.clientId, driveSettings.apiKey || '');

        // Try to initialize Drive API
        try {
          await initGoogleDrive();
          setDriveInitialized(true);
          alert('Settings saved successfully! You can now connect to Google Drive.');
        } catch (error) {
          alert('Settings saved but failed to initialize Google Drive. Please check your Client ID.');
        }
      } else {
        alert('Settings saved successfully');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  // Backup handlers
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
      await loadData();
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

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft size={20} />
        <span className="font-medium">Back</span>
      </button>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {/* Scrollable tabs on mobile, regular on desktop */}
        <div className="border-b border-slate-200 overflow-x-auto">
          <div className="flex min-w-max">
            <button
              onClick={() => setTab('systems')}
              className={`flex-1 min-w-[100px] px-3 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                tab === 'systems'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              Chip Systems
            </button>
            <button
              onClick={() => setTab('laborers')}
              className={`flex-1 min-w-[100px] px-3 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                tab === 'laborers'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              Laborers
            </button>
            <button
              onClick={() => setTab('costs')}
              className={`flex-1 min-w-[80px] px-3 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                tab === 'costs'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              Costs
            </button>
            <button
              onClick={() => setTab('backup')}
              className={`flex-1 min-w-[80px] px-3 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                tab === 'backup'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              Backup
            </button>
            <button
              onClick={() => setTab('drive')}
              className={`flex-1 min-w-[100px] px-3 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                tab === 'drive'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              Google Drive
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {tab === 'systems' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Chip Systems</h3>
                <button
                  onClick={() => {
                    setEditingSystem(null);
                    setSystemForm({ name: '', chipSize: '1/4', feetPerLb: '', boxCost: '', baseSpread: '', topSpread: '' });
                    setShowSystemForm(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  <Plus size={18} />
                  New System
                </button>
              </div>

              {systems.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-600 mb-4">No systems created yet</p>
                  <button
                    onClick={() => {
                      setEditingSystem(null);
                      setSystemForm({ name: '', chipSize: '1/4', feetPerLb: '', boxCost: '', baseSpread: '', topSpread: '' });
                      setShowSystemForm(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={18} />
                    Create System
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {systems.map((system) => (
                    <div
                      key={system.id}
                      className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{system.name}</p>
                        <p className="text-sm text-slate-600 mt-1">
                          {system.chipSize}" chip | {system.feetPerLb} ft/lb | ${system.boxCost}/box
                        </p>
                        <p className="text-sm text-slate-600">
                          Base: {system.baseSpread} | Top: {system.topSpread}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditSystem(system)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={async () => {
                            await deleteSystem(system.id);
                            await loadData();
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showSystemForm && (
                <div className="mt-6 p-6 bg-slate-50 border border-slate-200 rounded-lg">
                  <h4 className="font-semibold text-slate-900 mb-4">
                    {editingSystem ? 'Edit System' : 'New System'}
                  </h4>
                  <form onSubmit={handleSaveSystem} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-2">System Name</label>
                        <input
                          type="text"
                          placeholder="e.g., Diamond, Silver"
                          value={systemForm.name}
                          onChange={(e) => setSystemForm({ ...systemForm, name: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-2">Chip Size</label>
                        <select
                          value={systemForm.chipSize}
                          onChange={(e) => setSystemForm({ ...systemForm, chipSize: e.target.value as ChipSize })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        >
                          <option value="1/4">1/4" chip</option>
                          <option value="1/8">1/8" chip</option>
                          <option value="1/16">1/16" chip</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-2">Feet per lb</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={systemForm.feetPerLb}
                          onChange={(e) => setSystemForm({ ...systemForm, feetPerLb: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-2">Box Cost ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={systemForm.boxCost}
                          onChange={(e) => setSystemForm({ ...systemForm, boxCost: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-2">Base Spread</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={systemForm.baseSpread}
                          onChange={(e) => setSystemForm({ ...systemForm, baseSpread: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-2">Top Spread</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={systemForm.topSpread}
                          onChange={(e) => setSystemForm({ ...systemForm, topSpread: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSystemForm(false);
                          setEditingSystem(null);
                        }}
                        className="px-4 py-2 bg-slate-300 text-slate-900 rounded-lg font-semibold hover:bg-slate-400 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {tab === 'laborers' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Laborers</h3>
                <button
                  onClick={() => {
                    setEditingLaborer(null);
                    setLaborerForm({ name: '', fullyLoadedRate: '', isActive: true });
                    setShowLaborerForm(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  <Plus size={18} />
                  New Laborer
                </button>
              </div>

              {laborers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-600 mb-4">No laborers created yet</p>
                  <button
                    onClick={() => {
                      setEditingLaborer(null);
                      setLaborerForm({ name: '', fullyLoadedRate: '', isActive: true });
                      setShowLaborerForm(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={18} />
                    Create Laborer
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {laborers.map((laborer) => (
                    <div
                      key={laborer.id}
                      className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                        laborer.isActive
                          ? 'border-slate-200 hover:bg-slate-50'
                          : 'border-slate-200 bg-slate-100 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleToggleLaborerActive(laborer)}
                          className={`w-12 h-6 rounded-full transition-colors relative ${
                            laborer.isActive ? 'bg-green-500' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                              laborer.isActive ? 'left-7' : 'left-1'
                            }`}
                          />
                        </button>
                        <div>
                          <p className="font-semibold text-slate-900">{laborer.name}</p>
                          <p className="text-sm text-slate-600 mt-1">
                            ${laborer.fullyLoadedRate}/hr fully loaded
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditLaborer(laborer)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={async () => {
                            await deleteLaborer(laborer.id);
                            await loadData();
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showLaborerForm && (
                <div className="mt-6 p-6 bg-slate-50 border border-slate-200 rounded-lg">
                  <h4 className="font-semibold text-slate-900 mb-4">
                    {editingLaborer ? 'Edit Laborer' : 'New Laborer'}
                  </h4>
                  <form onSubmit={handleSaveLaborer} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-2">Name</label>
                        <input
                          type="text"
                          placeholder="e.g., John Smith"
                          value={laborerForm.name}
                          onChange={(e) => setLaborerForm({ ...laborerForm, name: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-2">Fully Loaded Rate ($/hr)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={laborerForm.fullyLoadedRate}
                          onChange={(e) => setLaborerForm({ ...laborerForm, fullyLoadedRate: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={laborerForm.isActive}
                          onChange={(e) => setLaborerForm({ ...laborerForm, isActive: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-slate-900">Active</span>
                      </label>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowLaborerForm(false);
                          setEditingLaborer(null);
                        }}
                        className="px-4 py-2 bg-slate-300 text-slate-900 rounded-lg font-semibold hover:bg-slate-400 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {tab === 'costs' && (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-6">Cost Settings</h3>
              <p className="text-sm text-slate-600 mb-6">
                These costs are used for new job calculations. Existing jobs retain their original cost values.
              </p>
              <form onSubmit={handleSaveCosts} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Base Cost per Gallon ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={costsForm.baseCostPerGal}
                      onChange={(e) => setCostsForm({ ...costsForm, baseCostPerGal: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Top Cost per Gallon ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={costsForm.topCostPerGal}
                      onChange={(e) => setCostsForm({ ...costsForm, topCostPerGal: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Crack Fill Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={costsForm.crackFillCost}
                      onChange={(e) => setCostsForm({ ...costsForm, crackFillCost: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Gas Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={costsForm.gasCost}
                      onChange={(e) => setCostsForm({ ...costsForm, gasCost: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Consumables Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={costsForm.consumablesCost}
                      onChange={(e) => setCostsForm({ ...costsForm, consumablesCost: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={costsSaving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {costsSaving ? 'Saving...' : 'Save Costs'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {tab === 'backup' && (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-6">Backup & Restore</h3>
              <p className="text-sm text-slate-600 mb-6">
                Export your data for backup or import from another device. When importing, only records newer than your local data will be updated.
              </p>

              {/* Export Section */}
              <div className="mb-8 p-6 bg-slate-50 border border-slate-200 rounded-lg">
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
          )}

          {tab === 'drive' && (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Google Drive Integration</h3>
              <p className="text-sm text-slate-600 mb-6">
                Connect your Google Drive account to automatically backup job photos to the cloud.
              </p>

              {/* Connection Status */}
              <div className="mb-6 p-4 border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {driveAuth && !isAuthExpired(driveAuth) ? (
                        <>
                          <Cloud className="text-green-600" size={20} />
                          <span className="font-semibold text-green-600">Connected</span>
                        </>
                      ) : (
                        <>
                          <CloudOff className="text-slate-400" size={20} />
                          <span className="font-semibold text-slate-600">Not Connected</span>
                        </>
                      )}
                    </div>
                    {driveAuth && driveAuth.userEmail && (
                      <p className="text-sm text-slate-600">Account: {driveAuth.userEmail}</p>
                    )}
                    {driveAuth && isAuthExpired(driveAuth) && (
                      <p className="text-sm text-orange-600">Token expired - please reconnect</p>
                    )}
                  </div>
                  <div>
                    {driveAuth && !isAuthExpired(driveAuth) ? (
                      <button
                        onClick={handleDisconnectDrive}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={handleConnectDrive}
                        disabled={driveAuthenticating || !driveInitialized}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
                      >
                        {driveAuthenticating ? 'Connecting...' : 'Connect to Google Drive'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* API Credentials Configuration */}
              <div className="mb-6 p-4 border border-slate-200 rounded-lg bg-slate-50">
                <h4 className="font-semibold text-slate-900 mb-3">API Credentials</h4>
                <p className="text-sm text-slate-600 mb-4">
                  Enter your Google Cloud OAuth Client ID. See setup instructions below for how to obtain it.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      Client ID <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={driveSettings.clientId || ''}
                      onChange={(e) =>
                        setDriveSettings({ ...driveSettings, clientId: e.target.value })
                      }
                      placeholder="123456789-abcdefg.apps.googleusercontent.com"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Required: OAuth 2.0 Client ID from Google Cloud Console
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      API Key <span className="text-slate-400 text-xs">(Optional)</span>
                    </label>
                    <input
                      type="password"
                      value={driveSettings.apiKey || ''}
                      onChange={(e) =>
                        setDriveSettings({ ...driveSettings, apiKey: e.target.value })
                      }
                      placeholder="AIzaSy... (optional)"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Optional: Can improve performance but not required for OAuth. Your credentials are stored securely in your browser's local database.
                    </p>
                  </div>
                </div>
              </div>

              {/* Configuration Warning */}
              {!driveInitialized && !driveSettings.clientId && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={18} />
                    <div className="text-sm">
                      <p className="font-semibold text-yellow-800 mb-1">Client ID required</p>
                      <p className="text-yellow-700">
                        Please enter your Google OAuth Client ID above and save settings to enable Google Drive integration.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Settings */}
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-900">Drive Settings</h4>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Root Folder Name
                  </label>
                  <input
                    type="text"
                    value={driveSettings.rootFolderName}
                    onChange={(e) =>
                      setDriveSettings({ ...driveSettings, rootFolderName: e.target.value })
                    }
                    placeholder="Jobs"
                    className="w-full max-w-md px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Job folders will be created inside this folder in your Google Drive
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoUpload"
                    checked={driveSettings.autoUpload}
                    onChange={(e) =>
                      setDriveSettings({ ...driveSettings, autoUpload: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="autoUpload" className="text-sm font-medium text-slate-900">
                    Automatically upload photos when online
                  </label>
                </div>

                <button
                  onClick={handleSaveDriveSettings}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Save Settings
                </button>
              </div>

              {/* Setup Instructions */}
              <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">How to Get Your Client ID</h4>
                <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                  <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google Cloud Console</a></li>
                  <li>Create a new project or select an existing one</li>
                  <li>Enable the <strong>Google Drive API</strong></li>
                  <li>Go to "APIs & Services" → "Credentials"</li>
                  <li>Click "Create Credentials" → <strong>OAuth 2.0 Client ID</strong></li>
                  <li>Choose "Web application" as the application type</li>
                  <li>Add your app's URL to authorized JavaScript origins and redirect URIs</li>
                  <li>Copy the <strong>Client ID</strong> and paste it above</li>
                  <li>Click "Save Settings" then "Connect to Google Drive"</li>
                </ol>
                <p className="text-xs text-blue-700 mt-3">
                  💡 The API Key is optional and not required for photo uploads. For detailed instructions, see GOOGLE_DRIVE_SETUP.md in the repository.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
