import { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import JobForm from './pages/JobForm';
import Settings from './pages/Settings';
import Inventory from './pages/Inventory';
import Calendar from './pages/Calendar';
import { useOnlineStatus } from './hooks/useOnlineStatus';

type Page = 'dashboard' | 'new-job' | 'edit-job' | 'settings' | 'inventory' | 'calendar';

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
      {currentPage === 'settings' && (
        <Settings onBack={handleBackToDashboard} />
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
