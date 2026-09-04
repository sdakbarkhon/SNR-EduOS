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
  CircuitBoard,
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
  Microscope,
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

/**
 * ТЕ ЖЕ ДВАДЦАТЬ ПЯТЬ ИМЁН, ЧТО У ВЕБА. 06.09.2026.
 *
 * Реестр здесь свой — и останется своим: графика у react-native другая, и
 * тянуть сюда веб-иконки нельзя. Но НАБОР ИМЁН обязан совпадать: имя значка
 * приходит из базы (`school_subjects.icon`), выбирает его админ из списка
 * веба, и всё, чего здесь нет, у родителя молча превращается в две буквы
 * названия.
 *
 * Так и было с `CircuitBoard` и `Microscope`: веб их завёл 04.09.2026, а сюда
 * они не доехали — «Схемотехника» и «Science» рисовались буквами. Теперь
 * добавлены. Третьего реестра не заводим: этот пополняется.
 */
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
  CircuitBoard,
  Microscope,
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
