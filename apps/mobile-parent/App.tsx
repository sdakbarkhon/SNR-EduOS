import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import RootNavigator from "./src/navigation/RootNavigator";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { DemoBanner } from "./src/components/DemoBanner";
import { getSupabase } from "./src/lib/supabase";
import { fetchParentProfile, type ParentProfile } from "./src/lib/auth";
import { LocaleProvider } from "./src/i18n";
import { DemoSessionProvider } from "./src/context/DemoSessionContext";

SplashScreen.preventAutoHideAsync().catch(() => {});

const STARTUP_TIMEOUT_MS = 10000;

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("startup_timeout")), ms);
  });
}

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

export default function App() {
  const [ready, setReady] = useState(false);
  const [initialProfile, setInitialProfile] = useState<ParentProfile | null>(null);
  // P2: rootNavRef позволяет DemoBanner дёрнуть переход обратно на Login
  // после signOut. Прокидываем через onDemoLoggedOut в RootNavigator.
  const onDemoLogoutRef = useRef<() => void>(() => {});

  useEffect(() => {
    checkForUpdateAndReload();
  }, []);

  useEffect(() => {
    (async () => {
      SplashScreen.hideAsync().catch(() => {});
      try {
        await Promise.race([
          (async () => {
            const db = getSupabase();
            const { data } = await db.auth.getSession();
            if (data.session) {
              const profile = await fetchParentProfile();
              if (profile) {
                setInitialProfile(profile);
              } else {
                await db.auth.signOut();
              }
            }
          })(),
          timeout(STARTUP_TIMEOUT_MS),
        ]);
      } catch {
        // Ошибка на старте не блокирует вход — идём на LoginScreen.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) {
    return (
      <ErrorBoundary>
        <View style={{ flex: 1, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <LocaleProvider>
        <DemoSessionProvider>
          <SafeAreaProvider>
            <StatusBar style="dark" />
            {/* P2: баннер над навигатором — виден на всех экранах после
                демо-логина. Внутри сам определяет isDemo и возвращает null
                для реальных сессий. */}
            <DemoBanner onLoggedOut={() => onDemoLogoutRef.current()} />
            <RootNavigator
              initialProfile={initialProfile}
              onDemoLogoutRefSet={(fn) => { onDemoLogoutRef.current = fn; }}
            />
          </SafeAreaProvider>
        </DemoSessionProvider>
      </LocaleProvider>
    </ErrorBoundary>
  );
}
