import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import {
  Unbounded_500Medium,
  Unbounded_600SemiBold,
  Unbounded_700Bold,
} from "@expo-google-fonts/unbounded";
import RootNavigator from "./src/navigation/RootNavigator";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { LocaleProvider } from "./src/i18n";
import { ThemeProvider, useTheme } from "./src/theme";
import { DevPanel } from "./src/dev/DevPanel";

SplashScreen.preventAutoHideAsync().catch(() => {});

/** По умолчанию expo-updates скачивает новый OTA-бандл в фоне на холодном
 *  старте, но применяет его только на СЛЕДУЮЩЕМ холодном старте — сама
 *  текущая сессия продолжает работать на старом JS. Без явного
 *  check+fetch+reload здесь пользователь, открывший приложение один раз,
 *  никогда не увидит только что опубликованный фикс, пока не закроет и не
 *  откроет приложение ЕЩЁ раз. */
async function checkForUpdateAndReload() {
  if (__DEV__ || !Updates.isEnabled) return;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch (e) {
    console.error("[App] OTA update check/fetch/reload failed:", e);
  }
}

/** StatusBar следует теме (внутри ThemeProvider). */
function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === "dark" ? "light" : "dark"} />;
}

/**
 * ЗАХОД 1 (редизайн v2): дерево живёт на фикстурах и заглушках.
 * DemoSessionProvider / DemoBanner и Supabase-восстановление сессии
 * НЕ монтируются — вход переписывается на этапе auth (Заход 10);
 * файлы (lib/auth.ts, lib/demoApi.ts, context/*) сохранены и вернутся
 * в дерево вместе с экранами входа a1–a4.
 */
export default function App() {
  // Шрифты редизайна (Manrope + Unbounded) должны загрузиться ДО первого
  // рендера экранов новой темы, иначе текст мигнёт системным шрифтом.
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Unbounded_500Medium,
    Unbounded_600SemiBold,
    Unbounded_700Bold,
  });

  useEffect(() => {
    checkForUpdateAndReload();
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <ErrorBoundary>
        <View style={{ flex: 1, backgroundColor: "#DCD2FD", alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <LocaleProvider>
        <ThemeProvider>
          <SafeAreaProvider>
            <ThemedStatusBar />
            <RootNavigator />
            {/* ВРЕМЕННАЯ dev-панель (тема/язык) — снести в Заходе 8 */}
            <DevPanel />
          </SafeAreaProvider>
        </ThemeProvider>
      </LocaleProvider>
    </ErrorBoundary>
  );
}
