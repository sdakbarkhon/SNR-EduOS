import React from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import ProjectsScreen from './components/ProjectsScreen';

export default function App() {
  return (
    <div 
      className="flex min-h-screen font-sans text-slate-800 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #f0f7ff 0%, #f5f3ff 50%, #ffffff 100%)' }}
    >
      {/* Background Orbs */}
      <div className="absolute w-96 h-96 bg-blue-300/20 rounded-full blur-[100px] -top-20 -left-20 animate-blob"></div>
      <div className="absolute w-[500px] h-[500px] bg-purple-300/20 rounded-full blur-[120px] -bottom-40 -right-20 animate-blob animation-delay-2000"></div>

      {/* Main Layout */}
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 relative z-10">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <ProjectsScreen />
        </main>
      </div>
    </div>
  );
}
