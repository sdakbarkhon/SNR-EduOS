import { Component, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useAppLocale } from "../i18n";

/**
 * Страховка на ОДИН экран.
 *
 * ЗАЧЕМ ОТДЕЛЬНО ОТ КОРНЕВОЙ. Корневой ErrorBoundary (components/
 * ErrorBoundary.tsx) ловит всё дерево целиком — и подменяет собой ВСЁ
 * приложение: падение одного экрана уносит и вкладки, и навигацию. Именно так
 * выглядела беда 16.08.2026: ошибка на главной («Cannot read property 'id' of
 * undefined») означала, что приложением нельзя пользоваться вовсе.
 *
 * Здесь граница проходит по экрану: сломался один — остальные работают, внизу
 * остаются вкладки, сверху кнопка «Назад». Человек видит понятную карточку,
 * а не белый лист, и может уйти в рабочий раздел.
 *
 * Ограничение React: ловятся только ошибки фазы отрисовки. Ошибка в
 * асинхронном ответе сети сюда не попадёт — для неё у экранов есть ErrorBlock.
 */

/** Видимая часть — отдельным компонентом, потому что классу нужны словари. */
function Fallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { d } = useAppLocale();
  const t = d.parentApp.common;
  return (
    <View style={{ flex: 1, backgroundColor: "#DCD2FD", paddingTop: 64, paddingHorizontal: 20 }}>
      <View
        style={{
          borderRadius: 20,
          backgroundColor: "rgba(255,255,255,0.82)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.9)",
          padding: 18,
          gap: 10,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: "800", color: "#1A1035" }}>
          {t.screenErrorTitle}
        </Text>
        <Text style={{ fontSize: 12, lineHeight: 18, color: "rgba(26,19,74,0.72)" }}>
          {t.screenErrorBody}
        </Text>

        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          style={{
            marginTop: 4,
            alignSelf: "flex-start",
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 14,
            backgroundColor: "#7C3AED",
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "800", color: "#FFFFFF" }}>{t.retry}</Text>
        </Pressable>

        {/* Текст ошибки — мелко и ниже: он нужен разработчику, а не родителю,
            но без него сообщение о поломке невозможно передать. */}
        <ScrollView style={{ maxHeight: 120, marginTop: 6 }}>
          <Text selectable style={{ fontSize: 10, lineHeight: 14, color: "rgba(26,19,74,0.45)" }}>
            {String(error?.message ?? error)}
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[экран упал]", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <Fallback error={this.state.error} onRetry={() => this.setState({ error: null })} />;
  }
}

/**
 * Обёртка для реестра экранов навигатора: `withScreenBoundary(HomeScreen)`.
 * Так граница стоит у каждого экрана, и её нельзя забыть поставить руками —
 * навигатор оборачивает весь свой список разом.
 */
export function withScreenBoundary<P extends object>(Screen: ComponentType<P>): ComponentType<P> {
  const Wrapped = (props: P) => (
    <ScreenErrorBoundary>
      <Screen {...props} />
    </ScreenErrorBoundary>
  );
  Wrapped.displayName = `withScreenBoundary(${Screen.displayName ?? Screen.name ?? "Screen"})`;
  return Wrapped;
}
