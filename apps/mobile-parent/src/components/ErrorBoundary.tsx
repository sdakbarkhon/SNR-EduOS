import { Component, type ErrorInfo, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

type Props = { children: ReactNode };
type State = { error: Error | null; componentStack: string | null };

/**
 * Ловит ошибки рендера/жизненного цикла во всём поддереве (включая
 * NavigationContainer и экраны) и вместо чёрного экрана / краша показывает
 * полный текст ошибки и stacktrace в прокручиваемом, выделяемом виде —
 * чтобы пользователь мог сфотографировать экран и прислать разработчику.
 *
 * Намеренно НЕ зависит от SafeAreaProvider / контекстов (использует обычный
 * View с ручным верхним отступом) — тогда fallback отрисуется, даже если
 * упал сам провайдер выше по дереву.
 *
 * Ограничение React: ErrorBoundary не ловит ошибки в асинхронных колбэках
 * и в коде инициализации модулей (до первого рендера) — только ошибки
 * фазы рендера дочерних компонентов.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, componentStack: info.componentStack ?? null });
    // Дублируем в консоль — видно в EAS device logs / adb logcat, если доступны.
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>⚠️ Ошибка запуска приложения</Text>
          <Text style={styles.hint}>
            Сфотографируйте этот экран целиком и пришлите разработчику.
          </Text>

          <Text style={styles.label}>Ошибка</Text>
          <Text selectable style={styles.mono}>
            {(error.name ? error.name + ": " : "") + (error.message || String(error))}
          </Text>

          {error.stack ? (
            <>
              <Text style={styles.label}>Stack trace</Text>
              <Text selectable style={styles.mono}>
                {error.stack}
              </Text>
            </>
          ) : null}

          {componentStack ? (
            <>
              <Text style={styles.label}>Component stack</Text>
              <Text selectable style={styles.mono}>
                {componentStack}
              </Text>
            </>
          ) : null}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff", paddingTop: 48 },
  content: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 18, fontWeight: "700", color: "#b91c1c", marginBottom: 8 },
  hint: { fontSize: 13, color: "#374151", marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#111827", marginTop: 14, marginBottom: 4 },
  mono: { fontFamily: "monospace", fontSize: 11, lineHeight: 16, color: "#111827" },
});
