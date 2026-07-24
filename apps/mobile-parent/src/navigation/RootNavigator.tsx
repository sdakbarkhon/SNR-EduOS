/**
 * Корневой навигатор v2 — Заход 1: сразу Main (стек 64 экранов на заглушках).
 *
 * БУДУЩИЙ AUTH-ЭТАП (Заход 10): здесь появится ветка входа a1–a4
 * (Онбординг → Телефон → SMS-код → Выбор ребёнка) с восстановлением
 * Supabase-сессии и demo-режимом. Файлы прежнего входа (lib/auth.ts,
 * lib/demoApi.ts, context/DemoSessionContext.tsx и др.) сохранены,
 * но в Заходе 1 не монтируются — всё живёт на фикстурах.
 */
import { DefaultTheme, NavigationContainer, type Theme } from "@react-navigation/native";
import MainNavigator from "./MainNavigator";
import { useTheme } from "../theme";

export default function RootNavigator() {
  const { tokens, scheme } = useTheme();

  // Фон контейнера ~ первый стоп bg-page, чтобы не было белой вспышки
  // на переходах; сам фон экранов рисует AppBackground.
  const navTheme: Theme = {
    ...DefaultTheme,
    dark: scheme === "dark",
    colors: {
      ...DefaultTheme.colors,
      primary: tokens.accent,
      background: tokens.bgPage.colors[0],
      text: tokens.ink1,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <MainNavigator />
    </NavigationContainer>
  );
}
