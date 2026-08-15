/**
 * Тело экрана «этого пока нет» — общее для всех разделов без данных.
 *
 * Отвечает на три вопроса и ничем не притворяется: ЧТО здесь будет, КОГДА
 * появится (условие, а не выдуманная дата) и ЧТО доступно сейчас. Тексты —
 * свои у каждого раздела, лежат в словаре (`parentApp.soon.items`) на трёх
 * языках; сюда приходит только ключ.
 *
 * Пользуются: StubScreen (все маршруты и действия без своего экрана) и
 * ChangePasswordScreen (форма ввода пароля убрана — менять код нельзя).
 */
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useAppLocale } from "../i18n";
import { fonts, gradPoints, useTheme } from "../theme";
import { GlassCard } from "../ui";

/** Один блок объяснения: подпись-заголовок + абзац. */
function SoonBlock({ cap, text }: { cap: string; text: string }) {
  const { tokens } = useTheme();
  return (
    <GlassCard radius={18} contentStyle={{ gap: 6, paddingVertical: 13, paddingHorizontal: 15 }}>
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 9.5,
          letterSpacing: 0.08 * 9.5,
          color: tokens.ink3,
        }}
      >
        {cap}
      </Text>
      <Text style={{ fontFamily: fonts.manrope600, fontSize: 11.5, lineHeight: 18, color: tokens.ink1 }}>
        {text}
      </Text>
    </GlassCard>
  );
}

export function SoonBody({
  title,
  gradient,
  iconPaths,
  itemKey,
}: {
  title: string;
  gradient: [string, string];
  iconPaths: string[];
  /** Ключ в d.parentApp.soon.items; неизвестный ключ → общий честный текст. */
  itemKey: string;
}) {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const soon = d.parentApp.soon;
  const item = soon.items[itemKey] ?? soon.items.fallback;
  const tile = gradPoints(135);
  const chip = tokens.chip(tokens.status.violet.rgb);

  return (
    <>
      {/* Плитка-иконка раздела — чтобы экран узнавался, а не читался пустым. */}
      <LinearGradient
        colors={gradient}
        start={tile.start}
        end={tile.end}
        style={{
          width: 78,
          height: 78,
          borderRadius: 24,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: gradient[1],
          shadowOffset: { width: 0, height: 18 },
          shadowRadius: 20,
          shadowOpacity: 0.3,
          elevation: 12,
        }}
      >
        <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          {iconPaths.map((p, i) => (
            <Path key={i} d={p} />
          ))}
        </Svg>
      </LinearGradient>

      <Text
        style={{
          fontFamily: fonts.unbounded600,
          fontSize: 17,
          color: tokens.ink1,
          textAlign: "center",
        }}
      >
        {title}
      </Text>

      {/* Главное сообщение экрана — не «в разработке», а честный срок-условие. */}
      <View
        style={{
          paddingVertical: 5,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: chip.bg,
          borderWidth: 1,
          borderColor: chip.border,
        }}
      >
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 10.5, color: tokens.status.violet.text }}>
          {soon.badge}
        </Text>
      </View>

      <View style={{ alignSelf: "stretch", gap: 9, marginTop: 4 }}>
        <SoonBlock cap={soon.whatCap} text={item.what} />
        <SoonBlock cap={soon.whenCap} text={item.when} />
        {item.now ? <SoonBlock cap={soon.nowCap} text={item.now} /> : null}
      </View>
    </>
  );
}
