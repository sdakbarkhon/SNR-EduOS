/**
 * Три состояния экрана на настоящих данных: идёт загрузка, запрос упал,
 * данных нет.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫМ КОМПОНЕНТОМ. Первые экраны, переведённые на базу
 * (расписание, посещаемость, домашние задания), рисовали эти три случая
 * прямо у себя — по 40 строк на экран. К седьмому экрану копий стало бы
 * семь, и «Повторить» на одном из них однажды отстал бы от остальных.
 * Здесь один вид на всех: спиннер, красная карточка с текстом ошибки и
 * кнопкой повтора, спокойная карточка «пусто» с объяснением.
 *
 * Ошибку НЕ прячем: `useAsyncData` не глотает исключения (см. его шапку), и
 * сообщение supabase показывается как есть — пустой экран вместо отказа в
 * правах однажды уже стоил дня расследования на вебе.
 */
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { fonts, useTheme } from "../theme";
import { GlassCard } from "./GlassCard";

/** Спиннер по центру — первая загрузка. */
export function LoadingBlock({ paddingVertical = 48 }: { paddingVertical?: number }) {
  const { tokens } = useTheme();
  return (
    <View style={{ paddingVertical, alignItems: "center" }}>
      <ActivityIndicator color={tokens.accent} />
    </View>
  );
}

/** Запрос упал: что не вышло + сообщение базы + «Повторить». */
export function ErrorBlock({
  title,
  message,
  retryLabel,
  onRetry,
}: {
  title: string;
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  const { tokens } = useTheme();
  const red = tokens.status.red;
  return (
    <GlassCard
      radius={20}
      contentStyle={{
        padding: 18,
        gap: 10,
        alignItems: "center",
        borderWidth: 1,
        borderColor: `rgba(${red.rgb},0.35)`,
      }}
    >
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: red.text, textAlign: "center" }}>
        {title}
      </Text>
      <Text style={{ fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink2, textAlign: "center" }}>
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 12,
          backgroundColor: `rgba(${red.rgb},0.14)`,
          borderWidth: 1,
          borderColor: `rgba(${red.rgb},0.4)`,
        }}
      >
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: red.text }}>{retryLabel}</Text>
      </Pressable>
    </GlassCard>
  );
}

/** Данных нет — с объяснением, откуда они здесь берутся, а не голым «пусто». */
export function EmptyBlock({ title, text }: { title: string; text?: string }) {
  const { tokens } = useTheme();
  return (
    <GlassCard radius={20} contentStyle={{ paddingVertical: 22, paddingHorizontal: 18, gap: 7, alignItems: "center" }}>
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1, textAlign: "center" }}>
        {title}
      </Text>
      {text ? (
        <Text
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 10.5,
            lineHeight: 10.5 * 1.5,
            color: tokens.ink2,
            textAlign: "center",
          }}
        >
          {text}
        </Text>
      ) : null}
    </GlassCard>
  );
}
