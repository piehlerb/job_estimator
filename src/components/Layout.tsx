import { useState, useEffect } from 'react';
import { Menu, X, WifiOff, Cog, Users, DollarSign, Tag, Home, Plus, Package, CalendarDays, LogOut, RefreshCw, Layers, SlidersHorizontal, BarChart3, Contact, Handshake, ShoppingBag, ShoppingCart, Building2, HardDrive, ChevronLeft, ChevronDown, Megaphone, Wrench, type LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSyncStatus } from '../contexts/SyncContext';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { signOut } from '../lib/auth';
import { APP_VERSION } from '../version';
import { canRead, type AppPage } from '../lib/permissions';

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
  'leads': 'Leads',
};

interface NavItem {
  page: AppPage;
  label: string;
  icon: LucideIcon;
}

const SETUP_OPEN_STORAGE_KEY = 'sidebar_setup_open_v1';

function VersionBadge() {
  return (
    <span className="num shrink-0 rounded-md border border-[#2f4a14] bg-[#14200a] px-2 py-0.5 text-xs font-bold text-[#a3e070]"
      title={`Version ${APP_VERSION}`}>
      v{APP_VERSION}
    </span>
  );
}

interface LayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
  onNavigate: (page: AppPage) => void;
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
  const canSeeLeads = canRead(permissions, 'leads');

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

  // Navigation, grouped so the everyday pages stay on top and configuration is tucked away
  const allowed = (items: (NavItem & { show: boolean })[]): NavItem[] => items.filter(item => item.show);
  const workItems = allowed([
    { page: 'dashboard', label: 'Dashboard', icon: Home, show: canSeeJobs },
    { page: 'calendar', label: 'Calendar', icon: CalendarDays, show: canSeeCalendar },
    { page: 'leads', label: 'Leads', icon: Megaphone, show: canSeeLeads },
    { page: 'customers', label: 'Customers', icon: Contact, show: canRead(permissions, 'customers') },
  ]);
  const materialItems = allowed([
    { page: 'inventory', label: 'Inventory', icon: Package, show: canRead(permissions, 'inventory') },
    { page: 'shopping-list', label: 'Shopping List', icon: ShoppingCart, show: canRead(permissions, 'inventory') },
  ]);
  const businessItems = allowed([
    { page: 'reporting', label: 'Reporting', icon: BarChart3, show: canRead(permissions, 'reporting') },
  ]);
  const setupItems = allowed([
    { page: 'referral-associates', label: 'Referral Associates', icon: Handshake, show: canRead(permissions, 'referralAssociates') },
    { page: 'products', label: 'Products', icon: ShoppingBag, show: canRead(permissions, 'products') },
    { page: 'chip-systems', label: 'Chip Systems', icon: Cog, show: canRead(permissions, 'chipSystems') },
    { page: 'chip-blends', label: 'Chip Blends', icon: Layers, show: canRead(permissions, 'chipBlends') },
    { page: 'laborers', label: 'Laborers', icon: Users, show: canRead(permissions, 'laborers') },
    { page: 'costs', label: 'Costs', icon: DollarSign, show: canRead(permissions, 'costs') },
    { page: 'pricing', label: 'Pricing', icon: Tag, show: canRead(permissions, 'pricing') },
    { page: 'settings', label: 'Settings', icon: SlidersHorizontal, show: canRead(permissions, 'settings') },
    { page: 'backup', label: 'Backup', icon: HardDrive, show: canRead(permissions, 'backup') },
  ]);

  const onSetupPage = setupItems.some(item => item.page === currentPage);
  const [setupOpen, setSetupOpen] = useState(() => {
    try { return localStorage.getItem(SETUP_OPEN_STORAGE_KEY) === 'true'; } catch { return false; }
  });
  // Always reveal the group that contains the page you are on
  useEffect(() => {
    if (onSetupPage) setSetupOpen(true);
  }, [onSetupPage]);
  const toggleSetup = () => {
    const next = !setupOpen;
    setSetupOpen(next);
    try { localStorage.setItem(SETUP_OPEN_STORAGE_KEY, String(next)); } catch { /* Storage may be unavailable. */ }
  };

  const navButton = ({ page, label, icon: Icon }: NavItem) => {
    const active = currentPage === page;
    return (
      <button
        key={page}
        onClick={() => onNavigate(page)}
        aria-current={active ? 'page' : undefined}
        className={`w-full flex items-center gap-3 min-h-11 px-3 rounded-lg text-sm text-left transition-colors ${
          active ? 'bg-[#1c1c1c] text-white font-bold' : 'text-slate-300 font-semibold hover:bg-[#161616] hover:text-white'
        }`}
      >
        <Icon size={18} className={`shrink-0 ${active ? 'text-gf-lime' : ''}`} />
        <span className="truncate">{label}</span>
      </button>
    );
  };

  const groupLabel = (label: string) => (
    <div className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</div>
  );

  // Mobile bottom navigation: up to three destinations the member can open, plus New job and More
  const bottomItems = [...workItems, ...materialItems].slice(0, 3);
  const bottomLeft = bottomItems.slice(0, 2);
  const bottomRight = bottomItems.slice(2);
  const moreActive = !isFormPage && !bottomItems.some(item => item.page === currentPage);

  const bottomNavButton = ({ page, label, icon: Icon }: NavItem) => {
    const active = currentPage === page;
    return (
      <button
        key={page}
        onClick={() => onNavigate(page)}
        aria-current={active ? 'page' : undefined}
        className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1.5 text-[11px] ${
          active ? 'font-extrabold text-gf-dark-green' : 'font-semibold text-slate-600'
        }`}
      >
        <Icon size={22} />
        <span className="truncate max-w-full">{page === 'dashboard' ? 'Home' : label}</span>
      </button>
    );
  };

  const syncLabel = !isOnline ? 'Offline' : !user ? 'Online' : isSyncing ? 'Syncing…' : 'Synced';

  return (
    <div className="flex h-screen bg-slate-200 md:bg-[#f6f7f9] overflow-hidden">
      {/* Backdrop overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={onSidebarToggle}
        />
      )}

      {/* Sidebar — hidden on mobile by default, opens from "More" in the bottom navigation */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 md:w-60 bg-[#0a0a0a] text-white shadow-lg transform transition-transform duration-300 ease-in-out z-40 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:static md:translate-x-0 md:shadow-none`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 px-6 pt-5 pb-4">
            <span className="font-heading text-[22px] font-bold text-gf-electric">GFS</span>
            <span className="flex-1 text-xs text-slate-400">Estimation</span>
            <VersionBadge />
            <button
              onClick={onSidebarToggle}
              aria-label="Close menu"
              className="md:hidden -mr-3 flex items-center justify-center w-11 h-11 rounded-lg text-slate-300 hover:text-white hover:bg-[#1c1c1c] transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <nav aria-label="Main" className="flex-1 overflow-y-auto scrollbar-hide px-3 pb-4 space-y-5">
            {canWriteJobs && !isDashboard && (
              <button
                onClick={() => onNavigate('new-job')}
                className="hidden md:flex w-full items-center justify-center gap-2 h-10 rounded-lg border border-[#2f4a14] text-sm font-bold text-[#a3e070] hover:bg-[#14200a] transition-colors"
              >
                <Plus size={16} strokeWidth={2.5} />
                New job
              </button>
            )}

            {workItems.length > 0 && (
              <div className="space-y-0.5">{workItems.map(navButton)}</div>
            )}

            {materialItems.length > 0 && (
              <div className="space-y-0.5">
                {groupLabel('Materials')}
                {materialItems.map(navButton)}
              </div>
            )}

            {(businessItems.length > 0 || setupItems.length > 0) && (
              <div className="space-y-0.5">
                {groupLabel('Business')}
                {businessItems.map(navButton)}
                {setupItems.length > 0 && (
                  <>
                    <button
                      onClick={toggleSetup}
                      aria-expanded={setupOpen}
                      aria-controls="sidebar-setup-items"
                      className="w-full flex items-center gap-3 min-h-11 px-3 rounded-lg text-sm font-semibold text-slate-300 text-left hover:bg-[#161616] hover:text-white transition-colors"
                    >
                      <Wrench size={18} className="shrink-0" />
                      <span className="flex-1">Setup</span>
                      <span className="num text-xs text-slate-400">{setupItems.length}</span>
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${setupOpen ? '' : '-rotate-90'}`} />
                    </button>
                    {setupOpen && (
                      <div id="sidebar-setup-items" className="ml-[21px] pl-2 border-l border-[#262626] space-y-0.5">
                        {setupItems.map(navButton)}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </nav>

          <div className="px-3 py-3 border-t border-[#1f1f1f] space-y-1">
            {user && (
              <button
                onClick={() => onNavigate('organization')}
                className="w-full flex items-center gap-3 min-h-11 px-3 rounded-lg hover:bg-[#161616] transition-colors text-left"
              >
                <Building2 size={16} className={`shrink-0 ${organization ? 'text-gf-lime' : 'text-slate-400'}`} />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-bold text-slate-200 truncate">
                    {organization ? organization.name : 'Personal Account'}
                  </span>
                  <span className="block text-xs text-slate-400 truncate">
                    {organization ? <span className="capitalize">{orgRole} · </span> : null}{user.email}
                  </span>
                </span>
              </button>
            )}

            <div className="flex items-center gap-1 pl-3 min-h-11">
              <div className="flex-1 min-w-0">
                {!isOnline ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-orange-300">
                    <WifiOff size={14} />
                    Offline
                  </div>
                ) : user ? (
                  <SyncStatusIndicator />
                ) : (
                  <div className="text-xs text-slate-400">Online</div>
                )}
              </div>
              {user && onManualSync && isOnline && (
                <button
                  onClick={onManualSync}
                  disabled={isSyncing}
                  aria-label="Sync now"
                  title={`Sync now · last sync: ${formatLastSyncTime()}`}
                  className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-300 hover:text-white hover:bg-[#1c1c1c] transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
                </button>
              )}
              {user && (
                <button
                  onClick={handleLogout}
                  aria-label="Log out"
                  title="Log out"
                  className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-300 hover:text-white hover:bg-[#1c1c1c] transition-colors"
                >
                  <LogOut size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Mobile header — dark */}
        {!isFormPage && (
          <div className="md:hidden bg-[#0a0a0a] text-white">
            <div className="px-4 py-3 flex items-center gap-2.5">
              {!isDashboard && (
                <button
                  onClick={() => onNavigate('dashboard')}
                  aria-label="Back to dashboard"
                  className="-ml-1.5 w-11 h-11 rounded-[10px] flex items-center justify-center text-slate-200 hover:bg-[#1c1c1c]"
                >
                  <ChevronLeft size={22} />
                </button>
              )}
              <h1 className="flex-1 min-w-0 truncate font-heading font-bold text-[22px] leading-none">
                {isDashboard ? 'Dashboard' : pageTitle}
              </h1>
              <VersionBadge />
              <span className="flex items-center gap-1.5 text-xs text-slate-300">
                <span className={`w-2 h-2 rounded-full ${!isOnline ? 'bg-orange-400' : isSyncing ? 'bg-gf-lime animate-pulse' : 'bg-gf-lime'}`} aria-hidden="true" />
                {syncLabel}
              </span>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto">
          {children}
        </main>

        {/* Mobile bottom navigation */}
        {!isFormPage && (
          <nav aria-label="Main" className="md:hidden flex items-center bg-white border-t border-slate-200 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {bottomLeft.map(bottomNavButton)}
            {canWriteJobs && (
              <button
                onClick={() => onNavigate('new-job')}
                aria-label="New job"
                className="shrink-0 mx-1.5 w-14 h-12 flex items-center justify-center rounded-[14px] bg-gf-dark-green text-white active:bg-[#3f631a]"
              >
                <Plus size={24} strokeWidth={2.5} />
              </button>
            )}
            {bottomRight.map(bottomNavButton)}
            <button
              onClick={onSidebarToggle}
              aria-expanded={sidebarOpen}
              className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1.5 text-[11px] ${
                moreActive ? 'font-extrabold text-gf-dark-green' : 'font-semibold text-slate-600'
              }`}
            >
              <Menu size={22} />
              <span>More</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
