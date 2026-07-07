import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import RootNavigator from "./src/navigation/RootNavigator";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { getSupabase } from "./src/lib/supabase";
import { fetchParentProfile, type ParentProfile } from "./src/lib/auth";

SplashScreen.preventAutoHideAsync().catch(() => {});

const STARTUP_TIMEOUT_MS = 10000;

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("startup_timeout")), ms);
  });
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [initialProfile, setInitialProfile] = useState<ParentProfile | null>(null);

  useEffect(() => {
    (async () => {
      // Сплэш убираем СРАЗУ, до всей async-цепочки: даже если инициализация
      // ниже упадёт или зависнет, приложение никогда не застрянет на сплэше.
      // Пока идёт init, показываем спиннер (ready=false), затем — навигатор.
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
                // Сессия есть, но это не родитель (или строка parents исчезла) — выходим.
                await db.auth.signOut();
              }
            }
          })(),
          timeout(STARTUP_TIMEOUT_MS),
        ]);
      } catch {
        // Ошибка на старте (сеть/хранилище/таймаут) не должна блокировать вход —
        // просто идём на LoginScreen как при отсутствии сессии.
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
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <RootNavigator initialProfile={initialProfile} />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
