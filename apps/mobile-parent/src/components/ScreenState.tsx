import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "../theme";

/** Одна прямоугольная shimmer-плашка skeleton-состояния. */
export function SkeletonBlock({ height, width, radius = radii.md, style }: {
  height: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: object;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 1, 0.6] });
  return (
    <Animated.View
      style={[
        { height, width: width ?? "100%", borderRadius: radius, backgroundColor: colors.skeletonBase, opacity },
        style,
      ]}
    />
  );
}

/** Скелетон общего вида экрана — заголовок + большая карточка + ряд плашек +
 *  несколько строк списка. Используется на первой загрузке каждого экрана. */
export function ScreenSkeleton() {
  return (
    <View style={{ padding: spacing.lg, gap: spacing.md }}>
      <SkeletonBlock height={22} width="55%" />
      <SkeletonBlock height={13} width="75%" />
      <SkeletonBlock height={132} radius={radii.xxl} />
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <SkeletonBlock height={70} radius={radii.xl} />
        <SkeletonBlock height={70} radius={radii.xl} />
      </View>
      <SkeletonBlock height={96} radius={radii.xxl} />
      <SkeletonBlock height={64} radius={radii.lg} />
      <SkeletonBlock height={64} radius={radii.lg} />
      <SkeletonBlock height={64} radius={radii.lg} />
    </View>
  );
}

/** "Не удалось загрузить" + кнопка "Попробовать снова" — единственный путь
 *  показать supabase-ошибку пользователю. НЕ использовать .catch(() => [])
 *  вместо этого нигде в экранах — это уже дважды ломало веб молча. */
export function ErrorState({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <View style={{ alignItems: "center", padding: spacing.xxl, gap: spacing.md }}>
      <View
        style={{
          width: 64, height: 64, borderRadius: 32, backgroundColor: colors.dangerBg,
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Ionicons name="cloud-offline-outline" size={28} color={colors.danger} />
      </View>
      <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 }}>
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        style={{
          backgroundColor: colors.primary, borderRadius: radii.md,
          paddingVertical: 11, paddingHorizontal: 22,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{retryLabel}</Text>
      </Pressable>
    </View>
  );
}

/** Пустое состояние (нет данных, не ошибка) — иконка + заголовок + подпись. */
export function EmptyState({
  icon,
  title,
  description,
  iconColor = colors.primary,
  iconBg = "#EFEAFF",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  iconColor?: string;
  iconBg?: string;
}) {
  return (
    <View style={{ alignItems: "center", padding: spacing.xxl, paddingTop: 56 }}>
      <View
        style={{
          width: 88, height: 88, borderRadius: 44, backgroundColor: iconBg,
          alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
        }}
      >
        <Ionicons name={icon} size={34} color={iconColor} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary, marginBottom: 7 }}>
        {title}
      </Text>
      <Text style={{ fontSize: 12.5, color: colors.textSecondary, textAlign: "center", lineHeight: 19 }}>
        {description}
      </Text>
    </View>
  );
}
