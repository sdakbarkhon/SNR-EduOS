/**
 * Корневой навигатор v2 — Заход 4: развилка auth ⇄ main + демо-нотис.
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
 * ЗАХОД 5x (правка 3): жёлтый `DemoBannerGlass` поверх шапки удалён целиком
 * (и файл, и вьюверы, и i18n `auth.demoBanner` продолжают жить только как
 * legacy-строка). Вместо него — one-shot центр-модалка `DemoNoticeModal`:
 * автоматически всплывает один раз сразу после демо-входа (isDemo=true &&
 * !demoNoticeSeen), при нажатии «Понятно» флаг переключается на true и до
 * конца сессии больше не показывается. При signOut / демо-тапе
 * (performLogin(isDemoTap=true)) флаг сбрасывается обратно, поэтому
 * повторный демо-вход снова покажет её.
 * На phone-flow (isDemo=false) не показывается вообще.
 */
import { useMemo } from "react";
import { DefaultTheme, NavigationContainer, type Theme } from "@react-navigation/native";
import MainNavigator from "./MainNavigator";
import AuthNavigator from "./AuthNavigator";
import { useAuthSession } from "../context/AuthSessionContext";
import { DemoNoticeModal } from "../ui";
import { useAppLocale } from "../i18n";
import { useTheme } from "../theme";

export default function RootNavigator() {
  const { tokens, scheme } = useTheme();
  const { phase, isDemo, demoNoticeSeen, dismissDemoNotice } = useAuthSession();
  const { d } = useAppLocale();

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
  // One-shot центр-модалка «Демо-режим» — только когда мы уже в MainNavigator,
  // сессия помечена как isDemo и модалка ещё не была закрыта.
  const showDemoNotice = authenticated && isDemo && !demoNoticeSeen;

  return (
    <NavigationContainer theme={navTheme}>
      {authenticated ? <MainNavigator /> : <AuthNavigator />}
      <DemoNoticeModal
        visible={showDemoNotice}
        title={d.parentApp.demo.title}
        body={d.parentApp.demo.body}
        cta={d.parentApp.demo.cta}
        onDismiss={dismissDemoNotice}
      />
    </NavigationContainer>
  );
}
