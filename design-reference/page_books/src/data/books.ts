import { Calculator, Zap, Terminal, Landmark, MessageCircle, Ruler, Leaf, FlaskConical, LucideIcon } from 'lucide-react';

export type Book = {
  id: number;
  title: string;
  type: string;
  color: string;
  icon: LucideIcon;
  favorite: boolean;
};

export const books: Book[] = [
  {
    id: 1,
    title: 'Алгебра 7 класс',
    type: 'Учебник',
    color: 'from-blue-400 to-blue-600',
    icon: Calculator,
    favorite: false,
  },
  {
    id: 2,
    title: 'Физика 7 класс',
    type: 'Учебник',
    color: 'from-purple-400 to-purple-600',
    icon: Zap,
    favorite: true,
  },
  {
    id: 3,
    title: 'Информатика',
    type: 'Конспект',
    color: 'from-orange-400 to-orange-500',
    icon: Terminal,
    favorite: false,
  },
  {
    id: 4,
    title: 'История 7 класс',
    type: 'Учебник',
    color: 'from-amber-600 to-amber-800',
    icon: Landmark,
    favorite: false,
  },
  {
    id: 5,
    title: 'Английский язык',
    type: 'Сборник',
    color: 'from-pink-400 to-rose-500',
    icon: MessageCircle,
    favorite: true,
  },
  {
    id: 6,
    title: 'Геометрия 7 класс',
    type: 'Учебник',
    color: 'from-emerald-400 to-emerald-600',
    icon: Ruler,
    favorite: false,
  },
  {
    id: 7,
    title: 'Биология 7 класс',
    type: 'Учебник',
    color: 'from-green-400 to-green-600',
    icon: Leaf,
    favorite: false,
  },
  {
    id: 8,
    title: 'Химия 7 класс',
    type: 'Учебник',
    color: 'from-indigo-400 to-purple-500',
    icon: FlaskConical,
    favorite: true,
  },
];
