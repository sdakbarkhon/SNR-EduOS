import { FileText, BookOpen, Link as LinkIcon, Video, Presentation, FileImage, File } from 'lucide-react';
import { MaterialInfo } from '../types';

const iconMap = {
  PDF: FileText,
  Book: BookOpen,
  Link: LinkIcon,
  Video: Video,
  Presentation: Presentation,
  Image: FileImage,
  File: File,
};

export function MaterialCard({ material }: { material: MaterialInfo }) {
  const Icon = iconMap[material.type] || File;

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white/40 p-4 rounded-[20px] shadow-sm hover:shadow-lg transition-all group flex flex-col h-[180px] cursor-pointer relative overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center mb-2 z-10 w-full">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform ${material.colorHex}`}>
          <Icon className="w-10 h-10" />
        </div>
        <p className="text-sm font-bold text-slate-800 text-center leading-tight line-clamp-2 w-full px-2">
          {material.title}
        </p>
      </div>
      
      <div className="flex justify-between items-end mt-auto z-10 w-full">
        <div className="text-[10px] text-slate-400 truncate mr-2">
          {material.subject} · {material.type}
        </div>
        <div className="text-[10px] text-slate-400 whitespace-nowrap">
          {material.date}
        </div>
      </div>
    </div>
  );
}
