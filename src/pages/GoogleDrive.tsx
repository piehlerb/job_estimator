import { Cloud, CloudOff, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  getGoogleDriveAuth,
  saveGoogleDriveAuth,
  deleteGoogleDriveAuth,
  getGoogleDriveSettings,
  saveGoogleDriveSettings,
  getDefaultGoogleDriveSettings,
} from '../lib/db';
import { GoogleDriveAuth, GoogleDriveSettings as GoogleDriveSettingsType } from '../types';
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

export default function GoogleDrive() {
  const [driveAuth, setDriveAuth] = useState<GoogleDriveAuth | null>(null);
  const [driveSettings, setDriveSettings] = useState<GoogleDriveSettingsType>(getDefaultGoogleDriveSettings());
  const [driveAuthenticating, setDriveAuthenticating] = useState(false);
  const [driveInitialized, setDriveInitialized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const auth = await getGoogleDriveAuth();
    const settings = await getGoogleDriveSettings();

    setDriveAuth(auth);

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

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Google Drive Integration</h1>

      <div className="space-y-6">
        <p className="text-sm text-slate-600">
          Connect your Google Drive account to automatically backup job photos to the cloud.
        </p>

        {/* Connection Status */}
        <div className="p-4 border border-slate-200 rounded-lg">
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
                  disabled={driveAuthenticating || !hasCredentials()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                  {driveAuthenticating ? 'Connecting...' : driveAuth && isAuthExpired(driveAuth) ? 'Reconnect to Google Drive' : 'Connect to Google Drive'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* API Credentials Configuration */}
        <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
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
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
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
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
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
    </div>
  );
}
