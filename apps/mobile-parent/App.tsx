import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import RootNavigator from "./src/navigation/RootNavigator";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { getSupabase } from "./src/lib/supabase";
import { fetchParentProfile, type ParentProfile } from "./src/lib/auth";
import { LocaleProvider } from "./src/i18n";

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
 *  откроет приложение ЕЩЁ раз (а многие просто сворачивают, а не закрывают
 *  полностью). Это и объясняло "у одного телефона работает, у остальных —
 *  Ошибка соединения": фикс конфигурации Supabase URL/ANON_KEY (app.json's
 *  expo.extra) был опубликован через OTA корректно, но большинство
 *  устройств просто не успели забрать и ПРИМЕНИТЬ его за один запуск.
 *  Не блокирует ready/сплэш — если апдейт найден, reloadAsync() перезапускает
 *  весь JS-рантайм сразу, независимо от того, что уже успело отрендериться. */
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

  useEffect(() => {
    checkForUpdateAndReload();
  }, []);

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
      <LocaleProvider>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <RootNavigator initialProfile={initialProfile} />
        </SafeAreaProvider>
      </LocaleProvider>
    </ErrorBoundary>
  );
}
