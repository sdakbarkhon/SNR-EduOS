import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

// Промт МОБ-7 — RN-порт apps/web/components/EduOSAssistantIcon.tsx (Tailwind
// + lucide-react, недоступны в Expo). Тот же визуальный спец: круглый
// оранжево-жёлтый градиентный бейдж, белая иконка-искра по центру, размер
// задаёт вызывающий код через `size` (было — className "h-9 w-9" и т.п.).
// Цвета совпадают с web-версией (Tailwind orange-500/orange-400/yellow-400),
// не переиспользуем gradients.brand/warmCard из theme.ts — те замешивают
// фирменный фиолетовый/коралл, а здесь нужен именно orange->yellow спектр
// один в один с веб-иконкой EduOS Assistant.
const GRADIENT = ["#F97316", "#FB923C", "#FACC15"] as const; // orange-500 -> orange-400 -> yellow-400

export function EduOSAssistantIcon({ size = 36 }: { size?: number }) {
  return (
    <LinearGradient
      colors={GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size, height: size, borderRadius: size / 2,
        alignItems: "center", justifyContent: "center",
        shadowColor: "#F97316", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
      }}
    >
      <Ionicons name="sparkles" size={size / 2} color="#fff" />
    </LinearGradient>
  );
}
