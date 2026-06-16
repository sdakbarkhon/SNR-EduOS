import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './components/Dashboard'

export default function App() {
  return (
    <div className="flex h-screen bg-gradient-to-br from-[#e2edff] via-[#f3e5f5] to-[#cfe2ff] overflow-hidden font-sans text-gray-800">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full relative z-10 w-full overflow-hidden">
        {/* Background glow blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-20">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-300/30 mix-blend-multiply filter blur-[100px]"></div>
            <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-300/30 mix-blend-multiply filter blur-[100px]"></div>
            <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[60%] rounded-full bg-purple-300/30 mix-blend-multiply filter blur-[100px]"></div>
        </div>
        <div className="absolute inset-0 bg-white/20 backdrop-blur-[60px] -z-10 pointer-events-none"></div>
        
        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-10 flex flex-col space-y-6">
           <Header />
           <Dashboard />
        </div>
      </main>
    </div>
  )
}
