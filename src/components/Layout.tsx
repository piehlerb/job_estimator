import { Menu, X, Wifi, WifiOff, Cog, Users, DollarSign, Home, Plus, Package, CalendarDays, LogOut, User, RefreshCw, Layers, SlidersHorizontal, BarChart3, Contact, ShoppingBag, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSyncStatus } from '../contexts/SyncContext';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { signOut } from '../lib/auth';
import { APP_VERSION } from '../version';

interface LayoutProps {
  children: React.ReactNode;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
  onNavigate: (page: 'dashboard' | 'new-job' | 'edit-job' | 'chip-systems' | 'chip-blends' | 'laborers' | 'costs' | 'pricing' | 'settings' | 'inventory' | 'calendar' | 'reporting' | 'customers' | 'products' | 'organization') => void;
  isOnline: boolean;
  onManualSync?: () => void;
}

export default function Layout({
  children,
  sidebarOpen,
  onSidebarToggle,
  onNavigate,
  isOnline,
  onManualSync,
}: LayoutProps) {
  const { user, organization, orgRole } = useAuth();
  const { isSyncing, lastSyncTime } = useSyncStatus();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      await signOut();
      window.location.reload(); // Reload to show login screen
    }
  };

  const formatLastSyncTime = () => {
    if (!lastSyncTime) return 'Never';

    const now = new Date();
    const diff = now.getTime() - lastSyncTime.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 min ago';
    if (minutes < 60) return `${minutes} mins ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;

    return lastSyncTime.toLocaleDateString();
  };
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Backdrop overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={onSidebarToggle}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-black text-white shadow-lg transform transition-transform duration-300 ease-in-out z-40 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:static md:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 md:p-6 border-b border-gray-900">
            <h1 className="text-xl md:text-2xl font-bold text-gf-electric">Estimator</h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1">Estimation App</p>
            <div className="mt-3 inline-flex items-center rounded-md bg-gf-electric/20 px-2.5 py-1 text-xs font-semibold text-gf-electric border border-gf-electric/40">
              Version {APP_VERSION}
            </div>
          </div>

          <nav className="flex-1 p-2 md:p-4 space-y-1 md:space-y-2">
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
            >
              <Home size={18} className="md:w-5 md:h-5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => onNavigate('new-job')}
              className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
            >
              <Plus size={18} className="md:w-5 md:h-5" />
              <span>New Job</span>
            </button>

            <button
              onClick={() => onNavigate('inventory')}
              className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
            >
              <Package size={18} className="md:w-5 md:h-5" />
              <span>Inventory</span>
            </button>

            <button
              onClick={() => onNavigate('calendar')}
              className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
            >
              <CalendarDays size={18} className="md:w-5 md:h-5" />
              <span>Calendar</span>
            </button>

            <button
              onClick={() => onNavigate('reporting')}
              className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
            >
              <BarChart3 size={18} className="md:w-5 md:h-5" />
              <span>Reporting</span>
            </button>

            <button
              onClick={() => onNavigate('customers')}
              className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
            >
              <Contact size={18} className="md:w-5 md:h-5" />
              <span>Customers</span>
            </button>

            <button
              onClick={() => onNavigate('products')}
              className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
            >
              <ShoppingBag size={18} className="md:w-5 md:h-5" />
              <span>Products</span>
            </button>

            <button
              onClick={() => onNavigate('chip-systems')}
              className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
            >
              <Cog size={18} className="md:w-5 md:h-5" />
              <span>Chip Systems</span>
            </button>

            <button
              onClick={() => onNavigate('chip-blends')}
              className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
            >
              <Layers size={18} className="md:w-5 md:h-5" />
              <span>Chip Blends</span>
            </button>

            <button
              onClick={() => onNavigate('laborers')}
              className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
            >
              <Users size={18} className="md:w-5 md:h-5" />
              <span>Laborers</span>
            </button>

            <button
              onClick={() => onNavigate('costs')}
              className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
            >
              <DollarSign size={18} className="md:w-5 md:h-5" />
              <span>Costs</span>
            </button>

            <button
              onClick={() => onNavigate('pricing')}
              className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
            >
              <DollarSign size={18} className="md:w-5 md:h-5" />
              <span>Pricing</span>
            </button>

            <button
              onClick={() => onNavigate('settings')}
              className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
            >
              <SlidersHorizontal size={18} className="md:w-5 md:h-5" />
              <span>Settings</span>
            </button>
          </nav>

          <div className="p-2 md:p-4 border-t border-gray-900 space-y-2">
            {/* Organization indicator (if authenticated) */}
            {user && (
              <button
                onClick={() => onNavigate('organization')}
                className="w-full flex items-center gap-2 px-3 py-2 md:px-4 rounded-lg bg-gray-900/50 hover:bg-gray-900 transition-colors text-left"
              >
                <Building2 size={14} className={organization ? 'text-gf-electric' : 'text-slate-500'} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-300 truncate">
                    {organization ? organization.name : 'Personal Account'}
                  </p>
                  {organization && (
                    <p className="text-xs text-slate-500 capitalize">{orgRole}</p>
                  )}
                </div>
              </button>
            )}

            {/* Sync Status (if authenticated) */}
            {user && (
              <div className="px-3 py-2 md:px-4 rounded-lg bg-gray-900/50">
                <SyncStatusIndicator />
              </div>
            )}

            {/* User Info (if authenticated) */}
            {user && (
              <div className="px-3 py-2 md:px-4 rounded-lg bg-gray-900/50">
                <div className="flex items-center gap-2 mb-2">
                  <User size={14} className="text-slate-400" />
                  <span className="text-xs text-slate-400 truncate">{user.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-slate-300 hover:bg-gray-800 hover:text-white transition-colors"
                >
                  <LogOut size={14} />
                  <span>Log Out</span>
                </button>
              </div>
            )}

            {/* Online/Offline Status */}
            <div className="flex items-center justify-between px-3 py-2 md:px-4 rounded-lg bg-gray-900">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <>
                    <Wifi size={16} className="text-gf-electric md:w-[18px] md:h-[18px]" />
                    <span className="text-xs md:text-sm font-medium">Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff size={16} className="text-orange-400 md:w-[18px] md:h-[18px]" />
                    <span className="text-xs md:text-sm font-medium">Offline</span>
                  </>
                )}
              </div>
              <span className="text-xs text-slate-500">v{APP_VERSION}</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="px-3 py-3 md:px-6 md:py-4 flex items-center justify-between">
            <button
              onClick={onSidebarToggle}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <div className="flex-1 hidden md:block" />

            <div className="flex items-center gap-2 md:gap-3">
              {/* Sync Status (only show when authenticated) */}
              {user && onManualSync && isOnline && !isSyncing && (
                <button
                  onClick={onManualSync}
                  className="flex items-center gap-1.5 md:gap-2 px-2 py-1 md:px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs md:text-sm font-medium transition-colors"
                  title={`Last sync: ${formatLastSyncTime()}`}
                >
                  <RefreshCw size={14} className="md:w-4 md:h-4" />
                  <span className="hidden sm:inline">Sync Now</span>
                </button>
              )}

              {!isOnline && (
                <div className="flex items-center gap-1.5 md:gap-2 px-2 py-1 md:px-3 bg-orange-50 text-orange-700 rounded-full text-xs md:text-sm font-medium">
                  <WifiOff size={14} className="md:w-4 md:h-4" />
                  <span className="hidden sm:inline">Offline Mode</span>
                  <span className="sm:hidden">Offline</span>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
