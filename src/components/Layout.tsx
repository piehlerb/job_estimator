import { Menu, X, Wifi, WifiOff, Settings, Home, Plus, Package } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
  onNavigate: (page: 'dashboard' | 'new-job' | 'edit-job' | 'settings' | 'inventory') => void;
  isOnline: boolean;
}

export default function Layout({
  children,
  sidebarOpen,
  onSidebarToggle,
  onNavigate,
  isOnline,
}: LayoutProps) {
  return (
    <div className="flex h-screen bg-slate-50">
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-slate-900 text-white shadow-lg transform transition-transform duration-300 ease-in-out z-40 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:static md:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-800">
            <h1 className="text-2xl font-bold">Job Est</h1>
            <p className="text-slate-400 text-sm mt-1">Estimation App</p>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Home size={20} />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => onNavigate('new-job')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Plus size={20} />
              <span>New Job</span>
            </button>

            <button
              onClick={() => onNavigate('inventory')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Package size={20} />
              <span>Inventory</span>
            </button>

            <button
              onClick={() => onNavigate('settings')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Settings size={20} />
              <span>Settings</span>
            </button>
          </nav>

          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800">
              {isOnline ? (
                <>
                  <Wifi size={18} className="text-green-400" />
                  <span className="text-sm font-medium">Online</span>
                </>
              ) : (
                <>
                  <WifiOff size={18} className="text-orange-400" />
                  <span className="text-sm font-medium">Offline</span>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="px-6 py-4 flex items-center justify-between">
            <button
              onClick={onSidebarToggle}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <div className="flex-1 hidden md:block" />

            <div className="flex items-center gap-3">
              {!isOnline && (
                <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm font-medium">
                  <WifiOff size={16} />
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
