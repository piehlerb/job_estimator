import { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import JobForm from './pages/JobForm';
import JobSheet from './pages/JobSheet';
import ChipSystems from './pages/ChipSystems';
import ChipBlends from './pages/ChipBlends';
import Laborers from './pages/Laborers';
import Costs from './pages/Costs';
import Pricing from './pages/Pricing';
import GoogleDrive from './pages/GoogleDrive';
import Inventory from './pages/Inventory';
import Calendar from './pages/Calendar';
import Login from './pages/Login';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useAuth } from './contexts/AuthContext';
import { useAutoSync } from './hooks/useAutoSync';

type Page = 'dashboard' | 'new-job' | 'edit-job' | 'job-sheet' | 'chip-systems' | 'chip-blends' | 'laborers' | 'costs' | 'pricing' | 'google-drive' | 'inventory' | 'calendar';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const isOnline = useOnlineStatus();
  const { user, loading } = useAuth();

  // Auto sync - enabled only when user is authenticated and online
  const { triggerSync } = useAutoSync({
    enabled: !!user && !offlineMode,
    intervalMinutes: 5, // Sync every 5 minutes
    onSyncComplete: (result) => {
      if (result.errors.length > 0) {
        console.warn('Sync completed with errors:', result.errors);
      }
    },
    onSyncError: (error) => {
      console.error('Sync error:', error);
    },
  });

  const handleNavigation = (page: Page, jobId?: string) => {
    setCurrentPage(page);
    if (jobId) setEditingJobId(jobId);
    setSidebarOpen(false);
  };

  const handleBackToDashboard = () => {
    setCurrentPage('dashboard');
    setEditingJobId(null);
  };

  const handleLoginSuccess = () => {
    // User logged in successfully, app will re-render with user data
    setCurrentPage('dashboard');
  };

  const handleContinueOffline = () => {
    // User chose to use app offline
    setOfflineMode(true);
  };

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated and not in offline mode
  if (!user && !offlineMode) {
    return <Login onSuccess={handleLoginSuccess} onContinueOffline={handleContinueOffline} />;
  }

  // Job Sheet is rendered outside Layout (no sidebar/menu)
  if (currentPage === 'job-sheet' && editingJobId) {
    return <JobSheet jobId={editingJobId} onBack={handleBackToDashboard} />;
  }

  // User is authenticated or in offline mode - show main app
  return (
    <Layout
      sidebarOpen={sidebarOpen}
      onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
      onNavigate={handleNavigation}
      isOnline={isOnline}
      onManualSync={triggerSync}
    >
      {currentPage === 'dashboard' && (
        <Dashboard
          onNewJob={() => handleNavigation('new-job')}
          onEditJob={(id) => handleNavigation('edit-job', id)}
          onViewJobSheet={(id) => handleNavigation('job-sheet', id)}
        />
      )}
      {currentPage === 'new-job' && (
        <JobForm onBack={handleBackToDashboard} />
      )}
      {currentPage === 'edit-job' && editingJobId && (
        <JobForm jobId={editingJobId} onBack={handleBackToDashboard} />
      )}
      {currentPage === 'chip-systems' && (
        <ChipSystems />
      )}
      {currentPage === 'chip-blends' && (
        <ChipBlends />
      )}
      {currentPage === 'laborers' && (
        <Laborers />
      )}
      {currentPage === 'costs' && (
        <Costs />
      )}
      {currentPage === 'pricing' && (
        <Pricing />
      )}
      {currentPage === 'google-drive' && (
        <GoogleDrive />
      )}
      {currentPage === 'inventory' && (
        <Inventory />
      )}
      {currentPage === 'calendar' && (
        <Calendar onEditJob={(id) => handleNavigation('edit-job', id)} />
      )}
    </Layout>
  );
}

export default App;
