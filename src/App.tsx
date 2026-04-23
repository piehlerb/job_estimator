import { useState, useEffect, useRef } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import JobForm from './pages/JobForm';
import JobSheet from './pages/JobSheet';
import ChipSystems from './pages/ChipSystems';
import ChipBlends from './pages/ChipBlends';
import Laborers from './pages/Laborers';
import Costs from './pages/Costs';
import Pricing from './pages/Pricing';
import Settings from './pages/Settings';
import Inventory from './pages/Inventory';
import Calendar from './pages/Calendar';
import Reporting from './pages/Reporting';
import Customers from './pages/Customers';
import ReferralAssociates from './pages/ReferralAssociates';
import Products from './pages/Products';
import Organization from './pages/Organization';
import Backup from './pages/Backup';
import ShoppingList from './pages/ShoppingList';
import Login from './pages/Login';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useAuth } from './contexts/AuthContext';
import { useAutoSync } from './hooks/useAutoSync';
import { migrateCustomersFromJobs, cleanupMigratedCustomerDuplicates, migrateJobsDisableGasHeater } from './lib/jobMigration';
import { seedOfflineData } from './lib/seedData';
import { getAllJobs, updateJob } from './lib/db';

type Page = 'dashboard' | 'new-job' | 'edit-job' | 'job-sheet' | 'chip-systems' | 'chip-blends' | 'laborers' | 'costs' | 'pricing' | 'settings' | 'inventory' | 'shopping-list' | 'calendar' | 'reporting' | 'customers' | 'referral-associates' | 'products' | 'organization' | 'backup';

// Pages accessible to inventory_only org members
const INVENTORY_ONLY_PAGES: Page[] = ['inventory', 'shopping-list', 'organization'];

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [returnPage, setReturnPage] = useState<Page>('dashboard');
  const [offlineMode, setOfflineMode] = useState(false);
  const isOnline = useOnlineStatus();
  const { user, loading, orgAccessLevel, organization } = useAuth();

  // Redirect inventory_only users away from restricted pages
  useEffect(() => {
    if (organization && orgAccessLevel === 'inventory_only') {
      if (!INVENTORY_ONLY_PAGES.includes(currentPage)) {
        setCurrentPage('inventory');
      }
    }
  }, [orgAccessLevel, organization, currentPage]);
  const notifiedThisSessionRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let intervalId: number | null = null;

    const checkDueReminders = async () => {
      try {
        if (typeof window === 'undefined' || !('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;

        const notifyReminder = async (title: string, body: string, tag: string) => {
          if ('serviceWorker' in navigator) {
            try {
              const reg = await navigator.serviceWorker.ready;
              if (reg?.showNotification) {
                await reg.showNotification(title, { body, tag });
                return;
              }
            } catch (error) {
              console.warn('Service worker notification failed, falling back to Notification API:', error);
            }
          }

          new Notification(title, { body, tag });
        };

        const allJobs = await getAllJobs();
        const now = new Date();

        for (const job of allJobs) {
          const reminders = job.reminders || [];
          let changed = false;

          const updatedReminders = reminders.map((reminder) => {
            if (reminder.completed || reminder.notifiedAt) {
              return reminder;
            }

            const due = reminder.dueAt
              ? new Date(reminder.dueAt)
              : new Date(`${reminder.dueDate}T${reminder.dueTime}`);
            const key = `${job.id}:${reminder.id}`;
            if (isNaN(due.getTime()) || due.getTime() > now.getTime() || notifiedThisSessionRef.current.has(key)) {
              return reminder;
            }

            void notifyReminder(
              reminder.subject,
              reminder.details || `${job.name || 'Untitled Job'} reminder is due`,
              key
            );

            notifiedThisSessionRef.current.add(key);
            changed = true;
            return {
              ...reminder,
              notifiedAt: now.toISOString(),
              updatedAt: now.toISOString(),
            };
          });

          if (changed) {
            await updateJob({
              ...job,
              reminders: updatedReminders,
              updatedAt: now.toISOString(),
              synced: false,
            });
          }
        }
      } catch (error) {
        console.warn('Reminder notification check failed:', error);
      }
    };

    checkDueReminders();
    intervalId = window.setInterval(checkDueReminders, 60000);

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

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

  // One-time migration: seed customers store from existing job data
  useEffect(() => {
    if (!user && !offlineMode) return;

    // Seed default data for offline/demo users (skips if data already exists)
    if (offlineMode) {
      seedOfflineData().catch((err) => {
        console.warn('[Seed] Failed to seed offline data:', err);
      });
    }

    migrateCustomersFromJobs().then((count) => {
      if (count > 0) {
        console.log(`[Migration] Seeded ${count} customer(s) from job history`);
      }
    }).catch((err) => {
      console.warn('[Migration] Customer seed failed:', err);
    });

    cleanupMigratedCustomerDuplicates().then((count) => {
      if (count > 0) {
        console.log(`[Migration] Removed ${count} duplicate migrated- customer(s)`);
      }
    }).catch((err) => {
      console.warn('[Migration] Customer cleanup failed:', err);
    });

    migrateJobsDisableGasHeater().then((count) => {
      if (count > 0) {
        console.log(`[Migration] Backfilled disableGasHeater for ${count} job(s)`);
      }
    }).catch((err) => {
      console.warn('[Migration] disableGasHeater backfill failed:', err);
    });
  }, [user, offlineMode]);

  const handleNavigation = (page: Page, jobId?: string, returnTo?: Page) => {
    // Block navigation to restricted pages for inventory_only members
    if (organization && orgAccessLevel === 'inventory_only' && !INVENTORY_ONLY_PAGES.includes(page)) {
      return;
    }
    setCurrentPage(page);
    if (jobId) setEditingJobId(jobId);
    setReturnPage(returnTo ?? 'dashboard');
    setSidebarOpen(false);
  };

  const handleBackToDashboard = () => {
    setCurrentPage(returnPage);
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gf-lime mx-auto mb-4"></div>
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
        <JobForm onBack={handleBackToDashboard} onEditJob={(id) => handleNavigation('edit-job', id)} />
      )}
      {currentPage === 'edit-job' && editingJobId && (
        <JobForm key={editingJobId} jobId={editingJobId} onBack={handleBackToDashboard} onEditJob={(id) => handleNavigation('edit-job', id)} onViewJobSheet={(id) => handleNavigation('job-sheet', id)} />
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
      {currentPage === 'settings' && (
        <Settings />
      )}
      {currentPage === 'inventory' && (
        <Inventory onEditJob={(id) => handleNavigation('edit-job', id, 'inventory')} />
      )}
      {currentPage === 'calendar' && (
        <Calendar onEditJob={(id) => handleNavigation('edit-job', id)} />
      )}
      {currentPage === 'reporting' && (
        <Reporting onEditJob={(id) => handleNavigation('edit-job', id)} />
      )}
      {currentPage === 'customers' && (
        <Customers />
      )}
      {currentPage === 'referral-associates' && (
        <ReferralAssociates />
      )}
      {currentPage === 'products' && (
        <Products />
      )}
      {currentPage === 'organization' && (
        <Organization />
      )}
      {currentPage === 'backup' && (
        <Backup />
      )}
      {currentPage === 'shopping-list' && (
        <ShoppingList />
      )}
    </Layout>
  );
}

export default App;
