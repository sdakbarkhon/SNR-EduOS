/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { MaterialsHeader } from './components/MaterialsHeader';
import { FilterTabs } from './components/FilterTabs';
import { MaterialCard } from './components/MaterialCard';
import { RecentCard } from './components/RecentCard';
import { mockMaterials, mockRecentMaterials } from './data';

export default function App() {
  return (
    <div className="min-h-screen bg-[#F0F4FF] relative overflow-hidden font-sans flex text-slate-800 font-['Inter',_sans-serif]">
      {/* Decorative Background Spheres */}
      <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full bg-blue-200/40 blur-[80px]"></div>
      <div className="absolute bottom-[-150px] left-[200px] w-[500px] h-[500px] rounded-full bg-purple-200/30 blur-[100px]"></div>

      <Sidebar />

      <main className="flex-1 ml-[240px] relative z-10 flex flex-col p-8 min-h-screen h-screen overflow-y-auto">
        <Topbar />
        
        <MaterialsHeader />
        
        <FilterTabs />

        {/* Recently Opened Section */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-800 mb-4 px-1">Недавно открытые</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-4">
            {mockRecentMaterials.map(mat => (
              <RecentCard key={mat.id} material={mat} />
            ))}
          </div>
        </section>

        {/* Main Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1 content-start">
          {mockMaterials.map(mat => (
            <MaterialCard key={mat.id} material={mat} />
          ))}
        </div>
        
        <div className="mt-6 flex justify-center pb-8">
          <button className="px-10 py-3 bg-white/40 backdrop-blur-md border border-white/60 text-blue-600 font-bold rounded-2xl hover:bg-white/60 transition-all text-sm shadow-sm">
            Показать ещё
          </button>
        </div>
      </main>
    </div>
  );
}

