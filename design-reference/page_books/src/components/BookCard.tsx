import React from 'react';
import { Star } from 'lucide-react';
import { Book } from '../data/books';

interface BookCardProps {
  book: Book;
  key?: React.Key;
}

export default function BookCard({ book }: BookCardProps) {
  const Icon = book.icon;
  
  return (
    <div className="group cursor-pointer">
      <div className={`relative h-44 rounded-2xl bg-gradient-to-br ${book.color} overflow-hidden mb-3 flex items-center justify-center`}>
        <div className="absolute inset-0 book-cover-gradient pointer-events-none"></div>
        <button className="absolute top-3 right-3 p-1.5 glass-card !border-white/20 !shadow-none rounded-lg z-10 transition-colors hover:bg-white/80">
          <Star className={`w-4 h-4 ${book.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400/80'}`} />
        </button>

        <Icon className="w-12 h-12 text-white/50 relative z-0 group-hover:scale-110 transition-transform duration-300" strokeWidth={1.5} />
      </div>
      
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">{book.type}</p>
      <h3 className="text-sm font-bold text-slate-800 leading-tight">{book.title}</h3>
    </div>
  );
}
