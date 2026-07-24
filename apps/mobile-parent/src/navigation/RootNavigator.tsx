/**
 * Корневой навигатор v2 — Заход 4: развилка auth ⇄ main + демо-баннер.
 *
 * Один NavigationContainer, две ветки:
 *   phase === 'app'  → MainNavigator (стек 64 экранов, 5 табов рабочие).
 *   иначе             → AuthNavigator (Onboarding / Phone / SMS / ChildPicker).
 *
 * Ветка перевыбирается автоматически при изменении phase, поэтому
 * enterApp() / signOut() из AuthSessionContext эквивалентны
 * navigation.reset({routes:[{name:'main'|'auth'}]}) без ручного
 * навигационного вызова из экранов.
 *
 * Поверх MainNavigator монтируется DemoBannerGlass (жёлтая полоса макета):
 * viewer видит его пока isDemo=true. Крестик скрыт — по Заходу 4 закрывать
 * его нельзя (при logout баннер уходит вместе с фазой). pointerEvents="box-none"
 * на обёртке — тапы проходят к экрану, тапабельны только сам баннер и его дети.
 */
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DefaultTheme, NavigationContainer, type Theme } from "@react-navigation/native";
import MainNavigator from "./MainNavigator";
import AuthNavigator from "./AuthNavigator";
import { useAuthSession } from "../context/AuthSessionContext";
import { DemoBannerGlass } from "../ui";
import { useAppLocale } from "../i18n";
import { useTheme } from "../theme";

export default function RootNavigator() {
  const { tokens, scheme } = useTheme();
  const { phase, isDemo } = useAuthSession();
  const { d } = useAppLocale();
  const insets = useSafeAreaInsets();

  // Фон контейнера ~ первый стоп bg-page, чтобы не было белой вспышки
  // на переходах; сам фон экранов рисует AppBackground.
  const navTheme: Theme = useMemo(
    () => ({
      ...DefaultTheme,
      dark: scheme === "dark",
      colors: {
        ...DefaultTheme.colors,
        primary: tokens.accent,
        background: tokens.bgPage.colors[0],
        text: tokens.ink1,
      },
    }),
    [scheme, tokens.accent, tokens.bgPage.colors, tokens.ink1],
  );

  const authenticated = phase === "app";

  return (
    <NavigationContainer theme={navTheme}>
      <View style={{ flex: 1 }}>
        {authenticated ? <MainNavigator /> : <AuthNavigator />}
        {/* Демо-баннер поверх MainNavigator (скрыт на auth-экранах и без демо). */}
        {authenticated && isDemo ? (
          <View
            pointerEvents="box-none"
            style={[
              StyleSheet.absoluteFill,
              // top:40 (макет) + safe-area, чтобы не залезать под вырез iOS
              { top: Math.max(40, insets.top + 6) },
            ]}
          >
            <View
              pointerEvents="box-none"
              style={{ position: "absolute", left: 12, right: 12, top: 0 }}
            >
              {/* onClose не передаём — крестик по Заходу 4 недоступен. */}
              <DemoBannerGlass message={d.parentApp.auth.demoBanner} />
            </View>
          </View>
        ) : null}
      </View>
    </NavigationContainer>
  );
}
