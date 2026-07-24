/**
 * TabScreenScroll — обёртка над ScrollView для табов, автоматически
 * добавляющая нижний inset, равный высоте плавающего таб-бара +
 * safe-area + запас 12px.
 *
 * ЗАХОД 5x (правка 4A): 5 tab-screen (HomeScreen / ProgressScreen /
 * PaymentsScreen / MessagesScreen / ProfileHubScreen) раньше хардкодили
 * `paddingBottom: 118` или `120`. На iPhone с большим home-indicator
 * (insets.bottom = 34+) итоговое расстояние получалось слишком плотным,
 * а на Android с insets.bottom=0 — избыточным. Централизуем это в один
 * хук/компонент, чтобы новые табы получали корректный inset автоматически.
 *
 * Расчёт (см. `useTabBarBottomInset`):
 *   FLOATING_TAB_BAR_HEIGHT (~66px, разбор ниже) +
 *   Math.max(insets.bottom, 14)  (тот же offset, что использует
 *                                   `FloatingTabBar` для позиционирования) +
 *   12                            (визуальный запас над баром)
 *
 * Разбор FLOATING_TAB_BAR_HEIGHT: `FloatingTabBar` (см. src/ui/FloatingTabBar):
 *   – внешний контейнер: padding 7 (7×2 = 14);
 *   – каждый пункт: paddingVertical 8 (8×2 = 16), gap 3, иконка 20, лейбл ~13;
 *   – итого пункт ≈ 8+20+3+13+8 = 52px, плюс 14px внешнего padding = 66px.
 *
 * Используется через два интерфейса:
 *   – `useTabBarBottomInset()` — просто число, если экрану нужна ручная
 *     работа с insets (например, FlatList / SectionList);
 *   – `<TabScreenScroll>` — drop-in замена `<ScrollView>` для табов.
 */
import { forwardRef } from "react";
import { ScrollView, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Визуальная высота панели FloatingTabBar (без учёта её собственного
 * `bottom` offset и safe-area). Совпадает с фактическим рендером на
 * iOS/Android — измерено по разметке компонента.
 */
export const FLOATING_TAB_BAR_HEIGHT = 66;

/**
 * Хук: возвращает готовое число `paddingBottom` для скролл-контента внутри
 * таб-экранов. Работает и для 5 текущих корневых табов, и для будущих
 * экранов, которые будут подключены под тот же FloatingTabBar.
 */
export function useTabBarBottomInset(): number {
  const insets = useSafeAreaInsets();
  // Точно тот же offset, что `FloatingTabBar` использует для своего bottom:
  // Math.max(insets.bottom, 14). Значение 14 — исходный bottom макета.
  const barOffset = Math.max(insets.bottom, 14);
  return FLOATING_TAB_BAR_HEIGHT + barOffset + 12;
}

export interface TabScreenScrollProps extends ScrollViewProps {}

/**
 * Drop-in замена `<ScrollView>` для 5 корневых таб-экранов. Автоматически
 * применяет нижний inset. Если вызывающий экран уже передаёт
 * `contentContainerStyle`, наш paddingBottom добавляется первым — экран
 * при желании ещё может его переопределить своим (но по-умолчанию
 * получает корректное значение бесплатно).
 */
export const TabScreenScroll = forwardRef<ScrollView, TabScreenScrollProps>(
  function TabScreenScroll(
    { contentContainerStyle, showsVerticalScrollIndicator, ...rest },
    ref,
  ) {
    const bottomInset = useTabBarBottomInset();
    return (
      <ScrollView
        ref={ref}
        // На iOS автоматически корректирует top-inset под safe-area
        // (у нас шапка сама отступает, но не мешает).
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={showsVerticalScrollIndicator ?? false}
        contentContainerStyle={[
          { paddingBottom: bottomInset },
          contentContainerStyle,
        ]}
        {...rest}
      />
    );
  },
);
