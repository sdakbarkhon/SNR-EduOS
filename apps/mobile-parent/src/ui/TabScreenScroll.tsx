/**
 * TabScreenScroll — обёртка над ScrollView для 5 корневых таб-экранов.
 *
 * ЗАХОД 5x правка 4A — базовый механизм:
 *   Централизованный расчёт нижнего inset'а под плавающий FloatingTabBar
 *   (FLOATING_TAB_BAR_HEIGHT + safe-area bottom + запас), чтобы новые
 *   таб-экраны получали корректный отступ автоматически.
 *
 * ЗАХОД 5z — правка отсечения контента под таб-баром:
 *   Проблема: контент прокручивался ПОД плавающий стеклянный таб-бар и
 *   просвечивал через его полупрозрачное стекло — строки списка мешались
 *   с иконками бара.
 *
 *   Решение: ScrollView оборачивается в View с `marginBottom = bottomInset`.
 *   Прокручиваемая ЗОНА (viewport) заканчивается на высоте примерно
 *   ~12px выше верхней кромки таб-бара — контент, уходящий ниже, обрезается
 *   `ScrollView.overflow: hidden` (нативное поведение). При этом:
 *     • AppBackground (родитель по дереву, `flex:1, overflow:hidden` +
 *       LinearGradient через `StyleSheet.absoluteFill`) продолжает рисовать
 *       фон-градиент на ВСЮ высоту экрана, включая зону за таб-баром →
 *       сквозь стекло FloatingTabBar по-прежнему виден именно градиент, как
 *       задумано Liquid Glass;
 *     • нижний inset теперь применяется НЕ как `paddingBottom` на content,
 *       а как `marginBottom` на контейнер — это и есть отсечение;
 *     • маленький `paddingBottom: 8` в контентном контейнере даёт визуальный
 *       воздух между последней строкой и нижней кромкой видимой ScrollView.
 *
 * Разбор FLOATING_TAB_BAR_HEIGHT: `FloatingTabBar` (см. src/ui/FloatingTabBar):
 *   – внешний контейнер: padding 7 (7×2 = 14);
 *   – каждый пункт: paddingVertical 8 (8×2 = 16), gap 3, иконка 20, лейбл ~13;
 *   – итого пункт ≈ 8+20+3+13+8 = 52px, плюс 14px внешнего padding = 66px.
 *
 * Используется через два интерфейса:
 *   – `useTabBarBottomInset()` — число, для экранов, использующих
 *     собственные скролл-контейнеры (FlatList / SectionList) — их автору
 *     нужно применить это значение к `style.marginBottom` контейнера +
 *     paddingBottom 8 к content, как здесь;
 *   – `<TabScreenScroll>` — drop-in замена `<ScrollView>` для 5 табов.
 */
import { forwardRef } from "react";
import { ScrollView, View, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Визуальная высота панели FloatingTabBar (без учёта её собственного
 * `bottom` offset и safe-area). Совпадает с фактическим рендером на
 * iOS/Android — измерено по разметке компонента.
 */
export const FLOATING_TAB_BAR_HEIGHT = 66;

/**
 * Хук: возвращает готовое число нижнего inset'а для tab-экранов.
 * Значение применяется как `marginBottom` на контейнере скролла (см.
 * TabScreenScroll) — контент чисто обрезается по верхней кромке таб-бара.
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
 * Drop-in замена `<ScrollView>` для 5 корневых таб-экранов. ScrollView
 * обёрнута в `<View marginBottom={bottomInset}>` — прокручиваемая зона
 * заканчивается над таб-баром, контент за ней обрезается. Фон-градиент
 * AppBackground продолжается на всю высоту экрана и просвечивает через
 * стекло таб-бара (по дизайну Liquid Glass).
 */
export const TabScreenScroll = forwardRef<ScrollView, TabScreenScrollProps>(
  function TabScreenScroll(
    { contentContainerStyle, showsVerticalScrollIndicator, style, ...rest },
    ref,
  ) {
    const bottomInset = useTabBarBottomInset();
    return (
      <View style={{ flex: 1, marginBottom: bottomInset }}>
        <ScrollView
          ref={ref}
          // На iOS автоматически корректирует top-inset под safe-area
          // (у нас шапка сама отступает, но не мешает).
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={showsVerticalScrollIndicator ?? false}
          style={style}
          contentContainerStyle={[
            // Небольшой воздух между последней строкой и нижней кромкой
            // видимой области ScrollView (сама нижняя кромка = верх таб-бара
            // с зазором ~12px, обеспечивается marginBottom на контейнере).
            { paddingBottom: 8 },
            contentContainerStyle,
          ]}
          {...rest}
        />
      </View>
    );
  },
);
