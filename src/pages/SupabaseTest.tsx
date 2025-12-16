import { useState, useEffect } from 'react';
import { Database, CheckCircle, XCircle, Loader, RefreshCw } from 'lucide-react';
import { testSupabaseConnection, getCurrentUser, supabase } from '../lib/supabase';
import { syncWithSupabase } from '../lib/sync';
import type { SyncResult } from '../types';

export default function SupabaseTest() {
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setTesting(true);
    setConnectionStatus('testing');
    setError(null);

    try {
      // Test connection
      const isConnected = await testSupabaseConnection();

      if (isConnected) {
        setConnectionStatus('success');
      } else {
        setConnectionStatus('failed');
        setError('Connection failed - check console for details');
      }

      // Check if user is logged in
      const currentUser = await getCurrentUser();
      setUser(currentUser);

    } catch (err: any) {
      setConnectionStatus('failed');
      setError(err.message || 'Unknown error');
    } finally {
      setTesting(false);
    }
  };

  const testQuery = async () => {
    try {
      setTesting(true);
      const { data, error } = await supabase
        .from('systems')
        .select('*')
        .limit(5);

      if (error) {
        alert(`Query error: ${error.message}`);
      } else {
        alert(`Query successful! Found ${data?.length || 0} systems.`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const testSync = async () => {
    try {
      setSyncing(true);
      setSyncResult(null);
      setError(null);

      const result = await syncWithSupabase();
      setSyncResult(result);

      if (result.success) {
        alert(`Sync successful!\n\nPushed: ${result.recordsPushed} records\nPulled: ${result.recordsPulled} records\nConflicts resolved: ${result.conflicts}`);
      } else {
        alert(`Sync completed with errors:\n\n${result.errors.join('\n')}`);
      }
    } catch (err: any) {
      setError(`Sync failed: ${err.message}`);
      alert(`Sync error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Supabase Connection Test</h1>

      <div className="space-y-6">
        {/* Connection Status */}
        <div className="p-6 border border-slate-200 rounded-lg bg-white">
          <div className="flex items-center gap-3 mb-4">
            <Database size={24} className="text-blue-600" />
            <h2 className="text-xl font-semibold text-slate-900">Connection Status</h2>
          </div>

          <div className="space-y-4">
            {/* Status Indicator */}
            <div className="flex items-center gap-3">
              {connectionStatus === 'testing' && (
                <>
                  <Loader className="animate-spin text-blue-600" size={20} />
                  <span className="text-slate-700">Testing connection...</span>
                </>
              )}
              {connectionStatus === 'success' && (
                <>
                  <CheckCircle className="text-green-600" size={20} />
                  <span className="text-green-700 font-medium">Connected successfully!</span>
                </>
              )}
              {connectionStatus === 'failed' && (
                <>
                  <XCircle className="text-red-600" size={20} />
                  <span className="text-red-700 font-medium">Connection failed</span>
                </>
              )}
              {connectionStatus === 'idle' && (
                <span className="text-slate-500">Ready to test</span>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Environment Variables */}
            <div className="p-4 bg-slate-50 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Environment Variables</h3>
              <div className="space-y-1 text-xs font-mono">
                <div>
                  <span className="text-slate-600">VITE_SUPABASE_URL:</span>{' '}
                  <span className={import.meta.env.VITE_SUPABASE_URL ? 'text-green-700' : 'text-red-700'}>
                    {import.meta.env.VITE_SUPABASE_URL ? '✓ Set' : '✗ Missing'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600">VITE_SUPABASE_ANON_KEY:</span>{' '}
                  <span className={import.meta.env.VITE_SUPABASE_ANON_KEY ? 'text-green-700' : 'text-red-700'}>
                    {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing'}
                  </span>
                </div>
              </div>
            </div>

            {/* User Status */}
            <div className="p-4 bg-slate-50 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Authentication Status</h3>
              {user ? (
                <div className="text-sm text-slate-700">
                  <p>✓ Logged in as: <span className="font-mono">{user.email}</span></p>
                  <p className="text-xs text-slate-500 mt-1">User ID: {user.id}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-600">✗ Not logged in</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={checkConnection}
                disabled={testing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>

              <button
                onClick={testQuery}
                disabled={testing || connectionStatus !== 'success'}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                Test Query
              </button>

              <button
                onClick={testSync}
                disabled={syncing || !user}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {syncing ? (
                  <>
                    <Loader className="animate-spin" size={18} />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={18} />
                    <span>Test Sync</span>
                  </>
                )}
              </button>
            </div>

            {/* Sync Result */}
            {syncResult && (
              <div className={`p-4 rounded-lg border ${syncResult.success ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <h3 className="text-sm font-semibold mb-2">{syncResult.success ? '✓ Sync Successful' : '⚠ Sync Completed with Warnings'}</h3>
                <div className="text-xs space-y-1">
                  <p>Pushed: {syncResult.recordsPushed} records</p>
                  <p>Pulled: {syncResult.recordsPulled} records</p>
                  <p>Conflicts: {syncResult.conflicts}</p>
                  {syncResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="font-semibold">Errors:</p>
                      <ul className="list-disc list-inside text-red-700">
                        {syncResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Database Info */}
        <div className="p-6 border border-slate-200 rounded-lg bg-blue-50">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">Database Setup Complete</h2>
          <div className="text-sm text-blue-800 space-y-2">
            <p>✓ Schema created with 13 tables</p>
            <p>✓ Row-Level Security (RLS) enabled</p>
            <p>✓ 52 security policies configured</p>
            <p>✓ Indexes and triggers in place</p>
          </div>
        </div>

        {/* Next Steps */}
        <div className="p-6 border border-slate-200 rounded-lg">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Next Steps</h2>
          <ol className="list-decimal list-inside text-sm text-slate-700 space-y-2">
            <li>Test the connection above (should show success)</li>
            <li>Implement authentication (signup/login)</li>
            <li>Build sync engine for data synchronization</li>
            <li>Test cross-device sync</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
