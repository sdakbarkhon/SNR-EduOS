export type MaterialType = 'PDF' | 'Book' | 'Link' | 'Video' | 'Presentation' | 'Image' | 'File';

export interface MaterialInfo {
  id: string;
  title: string;
  subject: string;
  type: MaterialType;
  date: string;
  colorHex: string;
}
