/* TODO(child-skills-schema): нет таблицы skills/child_skills в БД (проверено
 * аудитом Промта МОБ-3 — ни одной таблицы с 'skill' в имени, никакого
 * AI-summary поля нигде). Все значения ниже — MOCK, но детерминированный:
 * посчитаны хешем studentId, поэтому одинаковы на превью (#10) и детальном
 * экране (#16) и не "прыгают" при каждом обновлении экрана. Заменить на
 * реальный запрос, когда появится схема навыков. */
import type { Ionicons } from "@expo/vector-icons";

export type MockSkill = {
  key: string;
  nameKey:
    | "skillLogic"
    | "skillMath"
    | "skillCommunication"
    | "skillCreativity"
    | "skillTeamwork"
    | "skillSpeaking";
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  value: number; // 0..100
};

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function seededValue(seed: string, min: number, max: number): number {
  const h = hashSeed(seed);
  return min + (h % (max - min + 1));
}

const SKILL_DEFS: Array<{ key: string; nameKey: MockSkill["nameKey"]; icon: MockSkill["icon"]; color: string; bg: string }> = [
  { key: "logic", nameKey: "skillLogic", icon: "bulb-outline", color: "#6D4EE6", bg: "#EFEAFF" },
  { key: "math", nameKey: "skillMath", icon: "calculator-outline", color: "#00B8A9", bg: "#E0F7F4" },
  { key: "communication", nameKey: "skillCommunication", icon: "chatbubbles-outline", color: "#FF6B7A", bg: "#FFE9EE" },
  { key: "creativity", nameKey: "skillCreativity", icon: "color-palette-outline", color: "#FF9F43", bg: "#FFF3E4" },
  { key: "teamwork", nameKey: "skillTeamwork", icon: "people-outline", color: "#4D9FFF", bg: "#E8F2FF" },
  { key: "speaking", nameKey: "skillSpeaking", icon: "mic-outline", color: "#17A567", bg: "#E2F7EC" },
];

/** Все 6 mock-навыков ребёнка, детерминированных по studentId. */
export function getMockSkills(studentId: string): MockSkill[] {
  return SKILL_DEFS.map((def) => ({ ...def, value: seededValue(`${studentId}:${def.key}`, 58, 96) }));
}

/** Первые N навыков — для плашки-превью на #10 (Успехи). */
export function getMockSkillsPreview(studentId: string, count = 4): MockSkill[] {
  return getMockSkills(studentId).slice(0, count);
}

/** Общий индекс развития (0..5) — среднее по всем 6 mock-навыкам. */
export function getMockSkillsOverallIndex(studentId: string): number {
  const skills = getMockSkills(studentId);
  const avgPct = skills.reduce((sum, s) => sum + s.value, 0) / skills.length;
  return Math.round((avgPct / 100) * 5 * 10) / 10;
}
