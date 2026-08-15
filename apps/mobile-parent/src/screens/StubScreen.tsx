/**
 * Экран «Появится в будущих обновлениях».
 *
 * До захода 5 здесь стояла общая заглушка из макета: плитка, номер экрана и
 * одна и та же фраза «Экран в разработке» на все случаи жизни. Родитель,
 * нажавший «Справка» или «Выбор даты», видел ровно то же, что родитель,
 * нажавший «Новое заявление», и не понимал ни что это, ни чего ждать.
 *
 * Теперь экран отвечает на три вопроса, и по каждому разделу — своими словами
 * (см. SoonBody и `parentApp.soon.items` в словаре на трёх языках). Ключ —
 * stubKey нажатого действия, а для маршрутов без своего экрана — SOON_KEY ниже.
 */
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import type { Dictionary } from "@snr/core";
import { useAppLocale } from "../i18n";
import { AppBackground, useTheme, gradPoints, fonts } from "../theme";
import { ICONS, SCREEN_INFO, STUBS, type MainStackParamList, type StubInfo } from "../navigation/routes";
import { SoonBody } from "./soon";

/**
 * Заголовок: если у записи есть tKey («scr.notifications»), берём перевод из
 * d.parentApp (реагирует на смену языка); иначе — дословный t макета.
 */
function stubTitle(d: Dictionary, stub: StubInfo): string {
  if (!stub.tKey) return stub.t;
  const [section, key] = stub.tKey.split(".");
  const sec = (d.parentApp as unknown as Record<string, Record<string, string>>)[section];
  return sec?.[key] ?? stub.t;
}

/**
 * Маршруты без своего экрана → ключ объяснения.
 *
 * a1–a4 — экраны входа из первого прототипа: попасть в них из интерфейса уже
 * нельзя (вход ведёт AuthSessionContext), но маршруты оставлены — значит и у
 * них должен быть честный текст, а не «Экран в разработке».
 */
const SOON_KEY: Record<string, string> = {
  da1: "testreview",
  da2: "matview",
  da3: "workdet",
  da4: "appdet",
  da5: "newapp",
  da6: "search",
  da8: "whatsnew",
  ddoc: "docview",
  a1: "authproto",
  a2: "authproto",
  a3: "authproto",
  a4: "authproto",
};

const FALLBACK: StubInfo = STUBS.notif;

export default function StubScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<MainStackParamList, "stub">>();
  const insets = useSafeAreaInsets();

  const stubKey = route.name === "stub" ? route.params?.stubKey : undefined;
  const stub: StubInfo =
    (stubKey ? STUBS[stubKey] : undefined) ?? SCREEN_INFO[route.name] ?? FALLBACK;
  const title = stubTitle(d, stub);

  // Ключ объяснения: сначала нажатое действие, потом маршрут; если ни того,
  // ни другого в словаре нет — общий честный текст, а не пустой экран.
  const soon = d.parentApp.soon;
  const itemKey = (stubKey && soon.items[stubKey] ? stubKey : SOON_KEY[route.name]) ?? "fallback";

  const glass1 = gradPoints(tokens.glass1.angle);
  const canGoBack = navigation.canGoBack();
  const chip = tokens.chip(tokens.status.violet.rgb);

  return (
    <AppBackground>
      {/* Шапка: круглая кнопка «назад» + заголовок. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingTop: Math.max(insets.top, 46),
          paddingHorizontal: 18,
          paddingBottom: 8,
        }}
      >
        {canGoBack && (
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            style={{ width: 38, height: 38, borderRadius: 19, overflow: "hidden" }}
          >
            <LinearGradient
              colors={tokens.glass1.colors as [string, string]}
              start={glass1.start}
              end={glass1.end}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 19,
                borderWidth: 1,
                borderColor: tokens.glassBorder,
              }}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={tokens.ink1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M19 12H5" />
                <Path d="m12 19-7-7 7-7" />
              </Svg>
            </LinearGradient>
          </Pressable>
        )}
        <Text style={{ fontFamily: fonts.unbounded600, fontSize: 16, color: tokens.ink1 }}>
          {title}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 22,
          paddingTop: 18,
          paddingBottom: 140,
        }}
      >
        <SoonBody
          title={title}
          gradient={stub.g}
          iconPaths={ICONS[stub.i] || ICONS.doc}
          itemKey={itemKey}
        />

        {canGoBack && (
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            style={{
              alignSelf: "stretch",
              marginTop: 4,
              paddingVertical: 13,
              borderRadius: 16,
              alignItems: "center",
              backgroundColor: chip.bg,
              borderWidth: 1,
              borderColor: chip.border,
            }}
          >
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.status.violet.text }}>
              {soon.back}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </AppBackground>
  );
}
