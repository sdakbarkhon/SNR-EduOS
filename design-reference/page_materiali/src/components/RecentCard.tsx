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

export function RecentCard({ material }: { material: MaterialInfo }) {
  const Icon = iconMap[material.type] || File;

  return (
    <div className="w-full bg-white/70 backdrop-blur-xl border border-white/40 p-4 rounded-[20px] flex items-center space-x-3 shadow-sm hover:shadow-md transition-all cursor-pointer">
      <div className={`w-10 h-10 rounded-lg flex flex-shrink-0 items-center justify-center text-xs ${material.colorHex}`}>
        <Icon className="w-5 h-5" />
      </div>
      
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-800 truncate">{material.title}</p>
        <p className="text-[10px] text-slate-400">Вчера</p>
      </div>
    </div>
  );
}
