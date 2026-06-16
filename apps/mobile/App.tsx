import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getDictionary, defaultLocale } from "@snr/core";
import { colors } from "@snr/ui-tokens";
import { createSupabase } from "./lib/supabase";

// Заглушка Этапа 0: доказывает, что общий слой (@snr/core, @snr/ui-tokens) и
// клиент Supabase (expo-secure-store) подключены и собираются. Экраны — Этап 1.
export default function App() {
  const t = getDictionary(defaultLocale);
  const configured = Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL);

  const handleCheck = () => {
    try {
      createSupabase();
      console.log("Supabase client created");
    } catch (e) {
      console.warn(String(e));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t.common.appName}</Text>
      <Text style={styles.muted}>Платформа твоего будущего</Text>
      <Text style={styles.chip}>
        Этап 0 · {t.auth.title}
      </Text>
      <Pressable onPress={handleCheck}>
        <Text style={styles.muted}>
          Supabase: {configured ? "подключён" : "нужны EXPO_PUBLIC_SUPABASE_*"}
        </Text>
      </Pressable>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgApp,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  title: { fontSize: 28, fontWeight: "700", color: colors.primary },
  muted: { color: colors.textMuted },
  chip: {
    backgroundColor: colors.bgCard,
    color: colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
});
