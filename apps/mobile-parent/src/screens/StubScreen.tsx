/**
 * Экран «Заглушка» — перенос 1:1 из макета (разметка строки 2448–2460,
 * динамические стили/тексты renderVals строки 4677–4682).
 * В Заходе 1 его рендерят ВСЕ 64 маршрута: конфиг берётся из SCREEN_INFO
 * по имени маршрута, а маршрут 'stub' — дополнительно из params.stubKey
 * (аналог goStub(k) макета).
 */
import { Pressable, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import type { Dictionary } from "@snr/core";
import { useAppLocale } from "../i18n";
import { AppBackground, useTheme, gradPoints, fonts } from "../theme";
import { ICONS, SCREEN_INFO, STUBS, type MainStackParamList, type StubInfo } from "../navigation/routes";

/**
 * Заголовок заглушки: если у записи есть tKey («scr.notifications»), берём
 * перевод из d.parentApp (реагирует на смену языка в dev-панели); иначе —
 * дословный t макета (таких заголовков в словаре макета нет).
 */
function stubTitle(d: Dictionary, stub: StubInfo): string {
  if (!stub.tKey) return stub.t;
  const [section, key] = stub.tKey.split(".");
  const sec = (d.parentApp as unknown as Record<string, Record<string, string>>)[section];
  return sec?.[key] ?? stub.t;
}

/** Тексты фаз — дословно из renderVals макета (строки 4677–4678). */
function stubPhase(n: string): string {
  if (n === "Действие") return "Действие вне прототипа";
  if (n.indexOf("позже") > -1) return "Появится в следующих версиях";
  return "Экран в разработке";
}

function stubDesc(n: string): string {
  if (n === "Действие") {
    return "Здесь выполняется системное действие устройства — оно за рамками кликабельного прототипа.";
  }
  if (n.indexOf("позже") > -1) {
    return "Способ входа подключим после интеграции с провайдером.";
  }
  return "Содержание перенесём из комплекта А в этом же стиле — блок за блоком, ничего не сокращая.";
}

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

  const icon = ICONS[stub.i] || ICONS.doc;
  const glass1 = gradPoints(tokens.glass1.angle);
  const tileGrad = gradPoints(135);
  const canGoBack = navigation.canGoBack();

  return (
    <AppBackground>
      {/* Шапка: круглая кнопка «назад» + заголовок (макет: padding 46px 18px 8px) */}
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

      {/* Центр: плитка-иконка на градиенте, название, номер, фаза, описание */}
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          paddingHorizontal: 32,
          paddingBottom: 120,
        }}
      >
        <LinearGradient
          colors={stub.g}
          start={tileGrad.start}
          end={tileGrad.end}
          style={{
            width: 86,
            height: 86,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: stub.g[1],
            shadowOffset: { width: 0, height: 20 },
            shadowRadius: 22,
            shadowOpacity: 0.33,
            elevation: 12,
          }}
        >
          <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            {icon.map((d, i) => (
              <Path key={i} d={d} />
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
        <View
          style={{
            paddingVertical: 4,
            paddingHorizontal: 11,
            borderRadius: 999,
            backgroundColor: tokens.chip(tokens.status.violet.rgb).bg,
            borderWidth: 1,
            borderColor: tokens.chip(tokens.status.violet.rgb).border,
          }}
        >
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 10.5, color: tokens.status.violet.text }}>
            {stub.n}
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.manrope700, fontSize: 12, color: tokens.ink2 }}>
          {stubPhase(stub.n)}
        </Text>
        <Text
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 11,
            lineHeight: 11 * 1.6,
            color: tokens.ink3,
            textAlign: "center",
            maxWidth: 250,
          }}
        >
          {stubDesc(stub.n)}
        </Text>
      </View>
    </AppBackground>
  );
}
