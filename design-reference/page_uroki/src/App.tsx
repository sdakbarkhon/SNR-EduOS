/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { HeroCard } from './components/HeroCard';
import { LessonStages } from './components/LessonStages';
import { LessonMaterials } from './components/LessonMaterials';
import { LessonTask } from './components/LessonTask';
import { BackgroundSpheres } from './components/BackgroundSpheres';

export default function App() {
  return (
    <div className="min-h-screen flex font-sans text-[#1D1D1F] bg-[#F4F7FF] selection:bg-blue-200">
      <BackgroundSpheres />
      <Sidebar />
      
      <main className="flex-1 ml-[240px] flex flex-col h-screen overflow-y-auto relative z-0">
        <Topbar />
        
        <div className="px-10 py-6 space-y-6 max-w-5xl w-full mx-auto pb-12">
          <HeroCard />
          <LessonStages />
          <LessonMaterials />
          <LessonTask />
        </div>
      </main>
    </div>
  );
}
