/**
 * ЗНАЧОК ПРЕДМЕТА ПО ИМЕНИ ИЗ БАЗЫ. 30.08.2026.
 *
 * В таблице `subjects` есть колонка `icon` — там лежит ИМЯ значка lucide
 * ("Calculator", "BookOpen", ...), которое админ выбирает на веб-экране
 * «Предметы». Набор имён там закрытый: ICON_OPTIONS в
 * apps/web/app/admin/subjects/AdminSubjectsView.tsx — двадцать три штуки,
 * ровно они и перечислены ниже. Рисовать ничего не пришлось:
 * `lucide-react-native` уже стоит в зависимостях приложения (им нарисованы
 * значки нижних вкладок), поэтому карта — это «имя → готовый компонент», а не
 * «имя → набор SVG-путей».
 *
 * ПРЕДМЕТ, КОТОРОГО НЕТ В КАРТЕ, НЕ ЛОМАЕТ ЭКРАН. Возвращается null, и место
 * вызова рисует то, что рисовало раньше — две первые буквы названия. Это
 * важнее, чем кажется: `icon` в базе nullable, старые предметы заведены без
 * него, а веб-список ICON_OPTIONS когда-нибудь пополнится именем, которого
 * здесь ещё нет. Ни один из этих случаев не должен давать пустой квадрат или
 * падение.
 */
import type { ComponentType } from "react";
import {
  Atom,
  Bot,
  BookOpen,
  BookText,
  Calculator,
  Code,
  Dumbbell,
  FlaskConical,
  Globe,
  Hammer,
  Languages,
  Leaf,
  Library,
  Lightbulb,
  Map,
  Monitor,
  Music,
  Palette,
  Rocket,
  Scroll,
  Target,
  TreePine,
  Users,
} from "lucide-react-native";

type IconProps = { size?: number; color?: string; strokeWidth?: number };

/** Те же двадцать три имени, что предлагает админский выбор значка предмета. */
const SUBJECT_ICONS: Record<string, ComponentType<IconProps>> = {
  Calculator,
  BookOpen,
  Globe,
  Languages,
  BookText,
  Scroll,
  Map,
  Leaf,
  Atom,
  FlaskConical,
  Monitor,
  Code,
  Bot,
  Dumbbell,
  Music,
  Palette,
  Hammer,
  TreePine,
  Library,
  Users,
  Lightbulb,
  Target,
  Rocket,
};

/**
 * Значок предмета или `null`, если имени нет в карте (в т.ч. когда в базе
 * пусто). Вызывающий обязан обработать null — обычно прежней подписью.
 */
export function SubjectIcon({
  name,
  size = 16,
  color = "#FFFFFF",
}: {
  name: string | null | undefined;
  size?: number;
  color?: string;
}) {
  if (!name) return null;
  const Icon = SUBJECT_ICONS[name];
  if (!Icon) return null;
  return <Icon size={size} color={color} strokeWidth={2.4} />;
}
