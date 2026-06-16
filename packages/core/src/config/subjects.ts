import { colors } from "@snr/ui-tokens";

/**
 * РљРѕРЅС„РёРі В«С†РІРµС‚ + РёРєРѕРЅРєР° РЅР° РїСЂРµРґРјРµС‚В» (design_spec В§1.1, В§5). РћРґРёРЅ РёСЃС‚РѕС‡РЅРёРє РїСЂР°РІРґС‹ вЂ”
 * РЅРµ С…Р°СЂРґРєРѕРґРёС‚СЊ РїРѕ СЌРєСЂР°РЅР°Рј. `icon` вЂ” РєР»СЋС‡ РґР»СЏ lucide (web: lucide-react,
 * mobile: lucide-react-native). `subject` СЃРѕРІРїР°РґР°РµС‚ СЃ `groups.subject`.
 */
export interface SubjectStyle {
  label: string;
  color: string;
  icon: string;
}

export const subjects: Record<string, SubjectStyle> = {
  robotics: { label: "Р РѕР±РѕС‚РѕС‚РµС…РЅРёРєР°", color: "#2D5BFF", icon: "bot" },
  informatics: { label: "РРЅС„РѕСЂРјР°С‚РёРєР°", color: "#7A4DFF", icon: "monitor" },
  math: { label: "РњР°С‚РµРјР°С‚РёРєР°", color: "#F5A623", icon: "calculator" },
  physics: { label: "Р¤РёР·РёРєР°", color: "#39B6F5", icon: "atom" },
  english: { label: "РђРЅРіР»РёР№СЃРєРёР№", color: "#F0556B", icon: "languages" },
  history: { label: "РСЃС‚РѕСЂРёСЏ", color: "#B5793A", icon: "scroll" },
  biology: { label: "Р‘РёРѕР»РѕРіРёСЏ", color: "#2DBE7E", icon: "leaf" },
  chemistry: { label: "РҐРёРјРёСЏ", color: "#9B5DE5", icon: "flask-conical" },
};

export const defaultSubjectStyle: SubjectStyle = {
  label: "РџСЂРµРґРјРµС‚",
  color: colors.primary,
  icon: "book-open",
};

export function getSubjectStyle(subject: string | null | undefined): SubjectStyle {
  if (!subject) return defaultSubjectStyle;
  return subjects[subject] ?? defaultSubjectStyle;
}

