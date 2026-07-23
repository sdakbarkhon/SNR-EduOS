/**
 * Плавающий таб-бар (liquid glass). ПРЕЗЕНТАЦИОННЫЙ компонент: получает список
 * вкладок, активный ключ и колбэк — навигацию (react-navigation) подключим на
 * Этапе 2, когда появится первый экран-вкладка. Пока рендерится сам по себе.
 *
 * Из макета «1 Главная»: панель absolute bottom:22 left/right:18, стекло bright
 * blur, radius 32, тень tabBar; активная вкладка — градиентная «пилюля»
 * (tabActive), radius 24, тонкая светлая рамка + свечение glowViolet.
 */
import { StyleSheet, Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { type LucideIcon } from "lucide-react-native";
import { AppText } from "./AppText";
import { GlassCard } from "./GlassCard";
import { fonts, gradients, palette, radii, shadows } from "./theme";

export type TabItem = {
  key: string;
  label: string;
  icon: LucideIcon;
};

export function FloatingTabBar({
  tabs,
  activeKey,
  onTabPress,
  bottomInset = 0,
}: {
  tabs: readonly TabItem[];
  activeKey: string;
  onTabPress: (key: string) => void;
  /** safe-area снизу (жестовая полоса). */
  bottomInset?: number;
}) {
  return (
    <View style={[styles.wrap, { bottom: 22 + bottomInset }]} pointerEvents="box-none">
      <GlassCard variant="bright" radius={32} glow="tabBar" contentStyle={styles.row}>
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          const Icon = tab.icon;
          return (
            <Pressable key={tab.key} style={styles.item} onPress={() => onTabPress(tab.key)}>
              {active ? (
                <LinearGradient
                  colors={gradients.tabActive}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.activePill, shadows.glowViolet]}
                >
                  <Icon size={20} color={palette.text} strokeWidth={2.2} />
                  <AppText style={styles.activeLabel} numberOfLines={1}>
                    {tab.label}
                  </AppText>
                </LinearGradient>
              ) : (
                <View style={styles.inactive}>
                  <Icon size={20} color={palette.textMuted} strokeWidth={2} />
                  <AppText style={styles.inactiveLabel} numberOfLines={1}>
                    {tab.label}
                  </AppText>
                </View>
              )}
            </Pressable>
          );
        })}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 18, right: 18 },
  row: { flexDirection: "row", alignItems: "center", padding: 8, gap: 2 },
  item: { flex: 1 },
  activePill: {
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    paddingVertical: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 3,
  },
  activeLabel: { fontFamily: fonts.bold, fontSize: 10.5, color: palette.text },
  inactive: { paddingVertical: 9, alignItems: "center", gap: 3 },
  inactiveLabel: { fontFamily: fonts.semibold, fontSize: 10.5, color: palette.textMuted },
});
