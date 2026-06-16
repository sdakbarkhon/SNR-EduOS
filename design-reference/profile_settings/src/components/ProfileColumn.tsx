import { Camera, User, Phone, Mail } from "lucide-react";
import { GlassCard } from "./GlassCard";

export function ProfileColumn({ profileData }: any) {
  return (
    <GlassCard className="flex flex-col h-fit overflow-hidden p-8 basis-[35%] min-w-[300px]">
      <div className="flex flex-col items-center">
        {/* Avatar */}
        <div className="relative mb-8">
          <div className="w-36 h-36 rounded-full border-4 border-white shadow-xl overflow-hidden bg-white">
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Adilbek"
              alt={profileData.name}
              className="w-full h-full object-cover"
            />
          </div>
          {/* Edit Icon */}
          <button className="absolute bottom-1 right-2 bg-blue-600 text-white p-3 rounded-full shadow-lg border-2 border-white hover:bg-blue-700 transition-transform active:scale-95">
            <Camera size={18} />
          </button>
        </div>

        {/* Section Title */}
        <div className="w-full flex justify-center mb-6 border-b border-slate-200/50 pb-4">
          <h3 className="text-xl font-extrabold text-slate-800">Личные данные</h3>
        </div>

        {/* Fields */}
        <div className="w-full space-y-6">
          <div className="flex flex-col items-center mb-2">
            <h2 className="text-2xl font-extrabold text-slate-800">{profileData.name}</h2>
            <p className="text-xs text-blue-500 font-bold mt-1 uppercase tracking-wider">Студент EduOS</p>
          </div>
          
          <div className="bg-white/30 rounded-2xl p-6 border border-white/50 shadow-sm space-y-5">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">ФИО</p>
              <p className="font-bold text-slate-800 flex items-center gap-2">
                <User size={16} className="text-blue-500" />
                {profileData.name}
              </p>
            </div>
            
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Номер телефона</p>
              <p className="font-bold text-slate-700 flex items-center gap-2">
                <Phone size={16} className="text-slate-400" />
                {profileData.phone}
              </p>
            </div>
            
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">E-mail</p>
              <p className="font-bold text-slate-700 flex items-center gap-2">
                <Mail size={16} className="text-slate-400" />
                {profileData.email}
              </p>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
