import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initDB } from './lib/db.ts';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { SyncProvider } from './contexts/SyncContext.tsx';

initDB().catch(console.error);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <SyncProvider>
        <App />
      </SyncProvider>
    </AuthProvider>
  </StrictMode>
);
