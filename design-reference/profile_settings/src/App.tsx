import { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { ProfileColumn } from "./components/ProfileColumn";
import { SettingsColumn } from "./components/SettingsColumn";

export default function App() {
  const [activeTab, setActiveTab] = useState("Профиль");
  const [theme, setTheme] = useState("Светлая");
  const [profileData, setProfileData] = useState({
    name: "Адилбек Рахимов",
    phone: "+998 90 123 45 67",
    email: "student@email.com"
  });

  useEffect(() => {
    const root = window.document.documentElement;
    // Strictly enforcing Light Theme globally
    root.classList.remove("dark");
  }, [theme]);

  return (
    <div className="min-h-screen w-full relative flex flex-col font-sans text-slate-900 bg-gradient-to-br from-[#E0F2FE] via-[#F3E8FF] to-[#DBEAFE] overflow-x-hidden transition-colors duration-300">
      {/* Decorative 3D Floating Shapes */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-50px] right-[10%] w-64 h-64 bg-gradient-to-tr from-cyan-300 to-blue-400 rounded-full opacity-30 blur-2xl transition-colors duration-300"></div>
        <div className="absolute bottom-[10%] left-[-20px] w-80 h-80 bg-gradient-to-br from-purple-300 to-pink-300 rounded-full opacity-20 blur-3xl transition-colors duration-300"></div>
        <div className="absolute top-[40%] right-[30%] w-32 h-32 bg-white/20 rounded-[30%] rotate-45 backdrop-blur-sm border border-white/30 transition-colors duration-300"></div>
      </div>

      <div className="relative z-10 px-8 py-8 w-full max-w-5xl mx-auto flex flex-col h-full flex-grow">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-grow mt-2">
          <div className="grid lg:grid-cols-[360px_1fr] gap-8 items-stretch w-full">
            <ProfileColumn profileData={profileData} setProfileData={setProfileData} />
            <SettingsColumn activeTab={activeTab} theme={theme} setTheme={setTheme} profileData={profileData} />
          </div>
        </main>
      </div>
    </div>
  );
}
