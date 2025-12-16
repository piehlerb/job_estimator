import { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import JobForm from './pages/JobForm';
import ChipSystems from './pages/ChipSystems';
import Laborers from './pages/Laborers';
import Costs from './pages/Costs';
import Backup from './pages/Backup';
import GoogleDrive from './pages/GoogleDrive';
import Inventory from './pages/Inventory';
import Calendar from './pages/Calendar';
import { useOnlineStatus } from './hooks/useOnlineStatus';

type Page = 'dashboard' | 'new-job' | 'edit-job' | 'chip-systems' | 'laborers' | 'costs' | 'backup' | 'google-drive' | 'inventory' | 'calendar';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  const handleNavigation = (page: Page, jobId?: string) => {
    setCurrentPage(page);
    if (jobId) setEditingJobId(jobId);
    setSidebarOpen(false);
  };

  const handleBackToDashboard = () => {
    setCurrentPage('dashboard');
    setEditingJobId(null);
  };

  return (
    <Layout
      sidebarOpen={sidebarOpen}
      onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
      onNavigate={handleNavigation}
      isOnline={isOnline}
    >
      {currentPage === 'dashboard' && (
        <Dashboard onNewJob={() => handleNavigation('new-job')} onEditJob={(id) => handleNavigation('edit-job', id)} />
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
      {currentPage === 'laborers' && (
        <Laborers />
      )}
      {currentPage === 'costs' && (
        <Costs />
      )}
      {currentPage === 'backup' && (
        <Backup />
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
