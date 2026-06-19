import { useState } from 'react';
import { ViewState } from './types';
import { Background } from './components/Background';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Dashboard } from './pages/Dashboard';
import { Assignments } from './pages/Assignments';
import { Groups } from './pages/Groups';
import { Profile } from './pages/Profile';
import { AnimatePresence } from 'motion/react';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');

  return (
    <div className="fixed inset-0 overflow-hidden font-sans text-slate-800 flex">
      {/* Abstract Background Layer */}
      <Background />

      {/* Persistent Sidebar */}
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />

      {/* Main Content Flow */}
      <main className="flex-1 h-full flex flex-col relative z-10 overflow-hidden">
        <Topbar />
        
        <div className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="flex justify-center flex-col h-full w-full">
            <AnimatePresence mode="sync">
              {currentView === 'dashboard' && <Dashboard key="dashboard" />}
              {currentView === 'assignments' && <Assignments key="assignments" />}
              {currentView === 'groups' && <Groups key="groups" />}
              {currentView === 'profile' && <Profile key="profile" />}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
