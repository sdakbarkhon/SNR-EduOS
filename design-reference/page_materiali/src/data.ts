import { MaterialInfo } from './types';

export const mockMaterials: MaterialInfo[] = [
  {
    id: '1',
    title: 'Лабораторная работа №3',
    subject: 'Робототехника',
    type: 'PDF',
    date: '17 июня',
    colorHex: 'text-red-500 bg-red-100/50',
  },
  {
    id: '2',
    title: 'Конспект: системы уравнений',
    subject: 'Математика',
    type: 'Book',
    date: '16 июня',
    colorHex: 'text-blue-500 bg-blue-100/50',
  },
  {
    id: '3',
    title: 'Статья: история программирования',
    subject: 'Информатика',
    type: 'Link',
    date: '15 июня',
    colorHex: 'text-gray-500 bg-gray-100/50',
  },
  {
    id: '4',
    title: 'Видео: введение в Python',
    subject: 'Информатика',
    type: 'Video',
    date: '12 июня',
    colorHex: 'text-purple-500 bg-purple-100/50',
  },
  {
    id: '5',
    title: 'Презентация: основы Arduino',
    subject: 'Робототехника',
    type: 'Presentation',
    date: '10 июня',
    colorHex: 'text-orange-500 bg-orange-100/50',
  },
  {
    id: '6',
    title: 'Схема: подключение датчиков',
    subject: 'Физика',
    type: 'Image',
    date: '8 июня',
    colorHex: 'text-emerald-500 bg-emerald-100/50',
  },
  {
    id: '7',
    title: 'Инструкция к сборке робота',
    subject: 'Робототехника',
    type: 'PDF',
    date: '5 июня',
    colorHex: 'text-red-500 bg-red-100/50',
  },
  {
    id: '8',
    title: 'Примеры кода на Python',
    subject: 'Информатика',
    type: 'File',
    date: '2 июня',
    colorHex: 'text-slate-600 bg-slate-200/50',
  },
];

export const mockRecentMaterials: MaterialInfo[] = [
  mockMaterials[0],
  mockMaterials[3],
  mockMaterials[1],
  mockMaterials[4],
];
