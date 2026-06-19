import { Menu, X, Wifi, WifiOff, Cog, Users, DollarSign, Home, Plus, Package, CalendarDays, LogOut, User, RefreshCw, Layers, SlidersHorizontal, BarChart3, Contact, Handshake, ShoppingBag, ShoppingCart, Building2, HardDrive, ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSyncStatus } from '../contexts/SyncContext';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { signOut } from '../lib/auth';
import { APP_VERSION } from '../version';

import type { AppPage } from '../lib/permissions';

const PAGE_TITLES: Partial<Record<AppPage, string>> = {
  'chip-systems': 'Chip Systems',
  'chip-blends': 'Chip Blends',
  'laborers': 'Laborers',
  'costs': 'Costs',
  'pricing': 'Pricing',
  'settings': 'Settings',
  'inventory': 'Inventory',
  'shopping-list': 'Shopping List',
  'calendar': 'Calendar',
  'reporting': 'Reporting',
  'customers': 'Customers',
  'referral-associates': 'Referral Associates',
  'products': 'Products',
  'organization': 'Organization',
  'backup': 'Backup',
};

interface LayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
  onNavigate: (page: 'dashboard' | 'new-job' | 'edit-job' | 'chip-systems' | 'chip-blends' | 'laborers' | 'costs' | 'pricing' | 'settings' | 'inventory' | 'shopping-list' | 'calendar' | 'reporting' | 'customers' | 'referral-associates' | 'products' | 'organization' | 'backup') => void;
  isOnline: boolean;
  onManualSync?: () => void;
}

export default function Layout({
  children,
  currentPage,
  sidebarOpen,
  onSidebarToggle,
  onNavigate,
  isOnline,
  onManualSync,
}: LayoutProps) {
  const { user, organization, orgRole, permissions } = useAuth();
  const { isSyncing, lastSyncTime } = useSyncStatus();
  const canWriteJobs = permissions.jobs === 'write';
  const canSeeJobs = permissions.jobs !== 'none';
  const canSeeCalendar = permissions.calendar !== 'none';

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      await signOut();
      window.location.reload();
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

  const isDashboard = currentPage === 'dashboard';
  const isFormPage = currentPage === 'new-job' || currentPage === 'edit-job';
  const pageTitle = PAGE_TITLES[currentPage as AppPage] || '';

  return (
    <div className="flex h-screen bg-slate-200 md:bg-slate-50 overflow-hidden">
      {/* Backdrop overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={onSidebarToggle}
        />
      )}

      {/* Sidebar — hidden on mobile by default, slides in when toggled */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-black text-white shadow-lg transform transition-transform duration-300 ease-in-out z-40 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:static md:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 md:p-6 border-b border-gray-900 flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gf-electric">GFS</h1>
              <p className="text-slate-400 text-xs md:text-sm mt-1">Estimation App</p>
              <div className="mt-3 inline-flex items-center rounded-md bg-gf-electric/20 px-2.5 py-1 text-xs font-semibold text-gf-electric border border-gf-electric/40">
                Version {APP_VERSION}
              </div>
            </div>
            <button
              onClick={onSidebarToggle}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto scrollbar-hide p-2 md:p-4 space-y-1 md:space-y-2">
            {canSeeJobs && (
              <button
                onClick={() => onNavigate('dashboard')}
                className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
              >
                <Home size={18} className="md:w-5 md:h-5" />
                <span>Dashboard</span>
              </button>
            )}

            {canWriteJobs && (
              <button
                onClick={() => onNavigate('new-job')}
                className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
              >
                <Plus size={18} className="md:w-5 md:h-5" />
                <span>New Job</span>
              </button>
            )}

            {permissions.inventory && (
              <button
                onClick={() => onNavigate('inventory')}
                className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
              >
                <Package size={18} className="md:w-5 md:h-5" />
                <span>Inventory</span>
              </button>
            )}

            {permissions.inventory && (
              <button
                onClick={() => onNavigate('shopping-list')}
                className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
              >
                <ShoppingCart size={18} className="md:w-5 md:h-5" />
                <span>Shopping List</span>
              </button>
            )}

            {canSeeCalendar && (
              <button
                onClick={() => onNavigate('calendar')}
                className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
              >
                <CalendarDays size={18} className="md:w-5 md:h-5" />
                <span>Calendar</span>
              </button>
            )}

            {permissions.reporting && (
              <button
                onClick={() => onNavigate('reporting')}
                className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
              >
                <BarChart3 size={18} className="md:w-5 md:h-5" />
                <span>Reporting</span>
              </button>
            )}

            {permissions.customers && (
              <button
                onClick={() => onNavigate('customers')}
                className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
              >
                <Contact size={18} className="md:w-5 md:h-5" />
                <span>Customers</span>
              </button>
            )}

            {permissions.referralAssociates && (
              <button
                onClick={() => onNavigate('referral-associates')}
                className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
              >
                <Handshake size={18} className="md:w-5 md:h-5" />
                <span>Referral Associates</span>
              </button>
            )}

            {permissions.products && (
              <button
                onClick={() => onNavigate('products')}
                className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
              >
                <ShoppingBag size={18} className="md:w-5 md:h-5" />
                <span>Products</span>
              </button>
            )}

            {permissions.chipSystems && (
              <button
                onClick={() => onNavigate('chip-systems')}
                className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
              >
                <Cog size={18} className="md:w-5 md:h-5" />
                <span>Chip Systems</span>
              </button>
            )}

            {permissions.chipBlends && (
              <button
                onClick={() => onNavigate('chip-blends')}
                className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
              >
                <Layers size={18} className="md:w-5 md:h-5" />
                <span>Chip Blends</span>
              </button>
            )}

            {permissions.laborers && (
              <button
                onClick={() => onNavigate('laborers')}
                className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
              >
                <Users size={18} className="md:w-5 md:h-5" />
                <span>Laborers</span>
              </button>
            )}

            {permissions.costs && (
              <button
                onClick={() => onNavigate('costs')}
                className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
              >
                <DollarSign size={18} className="md:w-5 md:h-5" />
                <span>Costs</span>
              </button>
            )}

            {permissions.pricing && (
              <button
                onClick={() => onNavigate('pricing')}
                className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
              >
                <DollarSign size={18} className="md:w-5 md:h-5" />
                <span>Pricing</span>
              </button>
            )}

            {permissions.settings && (
              <button
                onClick={() => onNavigate('settings')}
                className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
              >
                <SlidersHorizontal size={18} className="md:w-5 md:h-5" />
                <span>Settings</span>
              </button>
            )}

            {permissions.backup && (
              <button
                onClick={() => onNavigate('backup')}
                className="w-full flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-slate-300 hover:bg-gray-900 hover:text-gf-electric transition-colors text-sm md:text-base"
              >
                <HardDrive size={18} className="md:w-5 md:h-5" />
                <span>Backup</span>
              </button>
            )}
          </nav>

          <div className="p-2 md:p-4 border-t border-gray-900 space-y-2">
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

            {user && (
              <div className="px-3 py-2 md:px-4 rounded-lg bg-gray-900/50">
                <SyncStatusIndicator />
              </div>
            )}

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
        {/* Mobile header — dark, matches design */}
        {!isFormPage && (
          <div className="md:hidden bg-[#0a0a0a] text-white">
            <div className="px-4 py-3 flex items-center justify-between">
              {isDashboard ? (
                <>
                  <div className="flex items-center gap-2.5">
                    <div className="w-[34px] h-[34px] rounded-[9px] bg-gradient-to-br from-[#b5e61d] to-[#39b54a] flex items-center justify-center font-heading font-black text-[13px] text-[#0a0a0a] tracking-tight">
                      GFS
                    </div>
                    <div>
                      <div className="font-heading font-extrabold text-[19px] leading-none">Estimates</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-[#1c1c1c] border border-[#2a2a2a] px-3 py-1.5 rounded-full">
                      <span className={`w-[7px] h-[7px] rounded-full ${isOnline ? 'bg-[#4cfa3e] shadow-[0_0_8px_#4cfa3e]' : 'bg-orange-400'}`} />
                      <span className="text-[11px] font-semibold text-slate-300">
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <button
                      onClick={onSidebarToggle}
                      className="p-1.5 rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] text-slate-300"
                    >
                      <Menu size={18} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => onNavigate('dashboard')}
                      className="w-[38px] h-[38px] rounded-[10px] bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="font-heading font-extrabold text-[17px]">{pageTitle}</span>
                  </div>
                  <button
                    onClick={onSidebarToggle}
                    className="p-1.5 rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] text-slate-300"
                  >
                    <Menu size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Desktop header */}
        <header className="hidden md:block bg-white border-b border-slate-200 shadow-sm">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              {user && onManualSync && isOnline && !isSyncing && (
                <button
                  onClick={onManualSync}
                  className="flex items-center gap-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-sm font-medium transition-colors py-1"
                  title={`Last sync: ${formatLastSyncTime()}`}
                >
                  <RefreshCw size={14} className="md:w-4 md:h-4" />
                  <span>Sync Now</span>
                </button>
              )}
              {!isOnline && (
                <div className="flex items-center gap-2 px-3 bg-orange-50 text-orange-700 rounded-full text-sm font-medium py-1">
                  <WifiOff size={14} />
                  <span>Offline Mode</span>
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
