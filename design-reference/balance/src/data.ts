import { CreditCard, Wallet, BookOpen, Cpu, Terminal, Languages } from 'lucide-react';

export const activeCourses = [
  {
    id: 'c1',
    name: 'Робототехника',
    schedule: 'Пн, Ср',
    price: 1500000,
    icon: Cpu,
    color: 'bg-indigo-100 text-indigo-600 border-indigo-200'
  },
  {
    id: 'c2',
    name: 'Разработка на Python',
    price: 500000,
    icon: Terminal,
    color: 'bg-emerald-100 text-emerald-600 border-emerald-200'
  },
  {
    id: 'c3',
    name: 'Английский язык',
    schedule: 'Вт, Чт',
    price: 800000,
    icon: Languages,
    color: 'bg-blue-100 text-blue-600 border-blue-200'
  }
];

export const paymentsHistory = [
  {
    id: '#TRX-9482',
    date: '14 июн 2026',
    method: 'Оплата картой',
    icon: CreditCard,
    amount: 1500000,
  },
  {
    id: '#TRX-8391',
    date: '02 июн 2026',
    method: 'Оплата картой',
    icon: CreditCard,
    amount: 500000,
  },
  {
    id: '#TRX-7210',
    date: '20 мая 2026',
    method: 'Наличные',
    icon: Wallet,
    amount: 1000000,
  }
];

export const chargesHistory = [
  {
    id: '#CHG-1029',
    date: '12 июн 2026',
    service: 'Оплата курса: Робототехника',
    category: 'Курс',
    icon: BookOpen,
    amount: 1500000,
  },
  {
    id: '#CHG-1028',
    date: '10 июн 2026',
    service: 'Оплата курса: Python',
    category: 'Курс',
    icon: BookOpen,
    amount: 500000,
  },
  {
    id: '#CHG-1027',
    date: '05 мая 2026',
    service: 'Оплата курса: Английский',
    category: 'Курс',
    icon: BookOpen,
    amount: 800000,
  }
];
