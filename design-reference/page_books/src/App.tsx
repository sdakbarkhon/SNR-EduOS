/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import BookCard from './components/BookCard';
import { books } from './data/books';

export default function App() {
  const filterTabs = [
    { label: 'Мои книги', active: true },
    { label: 'Библиотека школы', active: false },
    { label: 'Избранное', active: false },
  ];

  return (
    <div className="flex bg-[#f8faff] min-h-screen font-sans overflow-hidden relative selection:bg-blue-200">
      
      {/* Animated Background Spheres (Floating behind everything) */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="sphere w-[400px] h-[400px] bg-blue-100" style={{top: '-100px', right: '-100px'}}></div>
        <div className="sphere w-[300px] h-[300px] bg-indigo-50" style={{bottom: '-50px', left: '20%'}}></div>
      </div>

      <Sidebar />

      <div className="flex-1 flex flex-col relative z-10 w-full overflow-hidden h-screen">
        <Topbar />
        
        <main className="flex-1 overflow-y-auto pb-24 lg:pb-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-10 pt-2 flex flex-col justify-between">
            
            <section>
              <h1 className="text-3xl font-bold text-slate-800 mb-6">Книги и учебники</h1>

              <div className="flex flex-wrap gap-4 mb-8">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.label}
                    className={
                      tab.active
                        ? 'px-6 py-2.5 bg-blue-600 text-white rounded-full font-medium shadow-lg shadow-blue-200'
                        : 'px-6 py-2.5 glass-card text-slate-700 rounded-full font-medium'
                    }
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Main Content Area Container */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
                {books.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>
            </section>

            {/* Bottom CTA */}
            <footer className="mt-12 flex justify-center pb-6">
              <button className="bg-blue-600 text-white font-bold py-4 px-12 rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all">
                Открыть библиотеку
              </button>
            </footer>

          </div>
        </main>
      </div>
    </div>
  );
}
