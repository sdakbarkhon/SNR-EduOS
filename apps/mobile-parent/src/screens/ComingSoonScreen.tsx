/**
 * Экран «Скоро» — раздел, которого в базе школы ещё нет.
 *
 * ЧТО БЫЛО ДО 16.08.2026. Такие разделы показывали выдуманные данные (суммы,
 * счета, операции, переписку) с плашкой сверху «это пример». Заказчик решил
 * иначе: выдуманного содержимого быть не должно вовсе. Пустой экран честнее
 * правдоподобной подделки — родитель не должен гадать, настоящий ли перед ним
 * баланс.
 *
 * ЧТО ПОКАЗЫВАЕТ. По центру иконка раздела, под ней название и одна-две
 * строки: что здесь будет и при каком условии появится. Текст у каждого
 * раздела свой (словарь `parentApp.soon2`), на трёх языках.
 *
 * ШАПКА И ВКЛАДКИ ОСТАЮТСЯ. Экран выглядит частью приложения, а не ошибкой:
 * у стековых разделов сверху обычная шапка с «назад», у вкладки — корневая
 * шапка, а нижние вкладки рисует сам таб-навигатор.
 */
import type { ComponentType } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { AppBackground, fonts, gradPoints, useTheme } from "../theme";
import { InnerHeader, RootHeader } from "../ui";
import { useAppLocale } from "../i18n";
import { useDemoSession } from "../context/DemoSessionContext";
import { ICONS } from "../navigation/routes";

export type ComingSoonProps = {
  /** Ключ раздела в словаре parentApp.soon2 — он же задаёт название и текст. */
  sectionKey: string;
  /** Иконка из ICONS (та же, что у раздела в меню). */
  icon: string;
  /** Градиент плитки — цвет раздела, чтобы экран узнавался. */
  gradient: [string, string];
  /** Корневая вкладка рисует свою шапку без «назад». */
  root?: boolean;
};

export function ComingSoonScreen({ sectionKey, icon, gradient, root }: ComingSoonProps) {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation();
  const s = d.parentApp.soon2;
  const item = s.items[sectionKey] ?? s.fallback;
  const tile = gradPoints(135);
  const paths = ICONS[icon] ?? ICONS.doc;

  return (
    <AppBackground>
      {root ? (
        <RootHeader title={item.title} titleSize={17} />
      ) : (
        <InnerHeader title={item.title} onBackPress={() => navigation.goBack()} />
      )}

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 34, paddingBottom: 90, gap: 16 }}>
        <LinearGradient
          colors={gradient}
          start={tile.start}
          end={tile.end}
          style={{
            width: 84,
            height: 84,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: gradient[1],
            shadowOffset: { width: 0, height: 18 },
            shadowRadius: 22,
            shadowOpacity: 0.3,
            elevation: 12,
          }}
        >
          <Svg width={38} height={38} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            {paths.map((p, i) => (
              <Path key={i} d={p} />
            ))}
          </Svg>
        </LinearGradient>

        <Text style={{ fontFamily: fonts.unbounded600, fontSize: 17, color: tokens.ink1, textAlign: "center" }}>
          {item.title}
        </Text>

        <Text
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 12,
            lineHeight: 19,
            color: tokens.ink2,
            textAlign: "center",
          }}
        >
          {item.text}
        </Text>

        <View
          style={{
            marginTop: 2,
            paddingVertical: 6,
            paddingHorizontal: 14,
            borderRadius: 999,
            backgroundColor: tokens.chip(tokens.status.violet.rgb).bg,
            borderWidth: 1,
            borderColor: tokens.chip(tokens.status.violet.rgb).border,
          }}
        >
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 10.5, color: tokens.status.violet.text }}>
            {s.badge}
          </Text>
        </View>
      </View>
    </AppBackground>
  );
}

/**
 * Готовый экран для навигатора: `comingSoon("meals", "food", ["#f472b6","#db2777"])`.
 * Навигатор хранит компоненты, а не элементы, поэтому обёртка нужна.
 */
export function comingSoon(
  sectionKey: string,
  icon: string,
  gradient: [string, string],
  root = false,
) {
  const Screen = () => (
    <ComingSoonScreen sectionKey={sectionKey} icon={icon} gradient={gradient} root={root} />
  );
  Screen.displayName = `ComingSoon(${sectionKey})`;
  return Screen;
}

/**
 * Раздел, у которого настоящих данных в базе нет.
 *
 * ЗАЧЕМ. 16.08.2026 такие разделы стали честным пустым экраном — родитель не
 * должен принимать выдуманный баланс за свой. Но у демо задача другая: оно
 * показывает, КАК приложение будет выглядеть, и пустой экран этого не
 * показывает. Решение заказчика от 23.08: разница между демо и настоящим
 * входом — не в правах, а в том, чем заполнены разделы без данных.
 *
 * ЧТО ДЕЛАЕТ. Вошли через кнопку «Демо» — показывает demoScreen с выдуманными
 * данными. Вошли по номеру телефона — тот же самый ComingSoonScreen, что и
 * вчера, слово в слово.
 *
 * ПОЧЕМУ ПРИЗНАК ИМЕННО ТАКОЙ. isDemo — это наличие ключа аренды демо-места,
 * выданного сервером кнопке «Демо». Не «школа заморожена» и не «номер
 * телефона такой-то»: заведут второго настоящего родителя в демо-школе — и
 * он увидел бы выдуманное как своё.
 *
 * ШЕСТОЙ АРГУМЕНТ — НАСТОЯЩИЙ ЭКРАН, если он уже есть (29.08.2026). Раздел
 * перестаёт быть «Скоро» не разом для всех: у поддержки настоящий экран
 * появился, у остальных четырнадцати — ещё нет. Аргумент необязательный,
 * поэтому все прежние вызовы его не передают и ведут себя ровно как раньше:
 * демо-гостю витрина, настоящему родителю «Скоро». Витрина не затрагивается
 * ни в одном из трёх случаев — она всегда в первой ветке.
 */
export function demoOr(
  demoScreen: ComponentType<Record<string, never>>,
  sectionKey: string,
  icon: string,
  gradient: [string, string],
  root = false,
  realScreen?: ComponentType<Record<string, never>>,
) {
  const DemoScreen = demoScreen;
  const RealScreen = realScreen;
  const Screen = () => {
    const { isDemo } = useDemoSession();
    if (isDemo) return <DemoScreen />;
    if (RealScreen) return <RealScreen />;
    return <ComingSoonScreen sectionKey={sectionKey} icon={icon} gradient={gradient} root={root} />;
  };
  Screen.displayName = `DemoOr(${sectionKey})`;
  return Screen;
}
