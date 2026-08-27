/**
 * d33 «Способы оплаты».
 *
 * ПЕРЕПИСАН 27.08.2026 — ЭКРАН ГОВОРИЛ НЕПРАВДУ.
 *
 * Было: крупная карта UZCARD с маскированным номером, список сохранённых карт
 * HUMO и VISA со сроками действия, кнопка «Добавить карту» и три способа, из
 * которых Payme и Click значились привязанными зелёным. Ни одной карты в
 * проекте не хранится, ни один провайдер не подключён, таблицы платежей пусты.
 * Заказчик показывает приложение клиентам, и всё, что выглядит рабочим, он
 * нажимает.
 *
 * Стало: три способа из утверждённой модели — Payme, Click, Uzum, — все
 * неактивные, с подписью «Скоро». Ни привязанных аккаунтов, ни сохранённых
 * карт, ни кнопки «Добавить карту»: добавлять карту некуда, пока нет
 * провайдера.
 *
 * Ровно то же сделано у веб-родителя (payments/methods/PayMethodsView.tsx) —
 * два экрана обязаны говорить одно и то же.
 *
 * Нажимать здесь нечего: ни одна строка не Pressable. Это осознанно — «кнопки
 * в никуда» и были болезнью экрана.
 *
 * ЧТО УБРАНО РАНЬШЕ И ПОЧЕМУ (15.08.2026, оставлено для памяти). Экран вёл на
 * форму привязки карты из пяти полей, включая номер и CVV, у которой кнопка
 * просто закрывала экран. Форма, принимающая номер карты и делающая вид, что
 * сохранила, хуже её отсутствия: реквизиты карты приложение не должно видеть
 * даже когда провайдер появится — их принимает страница шлюза.
 */
import { ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, useTheme } from "../../theme";
import { GlassCard, InnerHeader } from "../../ui";
import { OTHER_METHODS } from "../../data/demoPayments";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList } from "../../navigation/routes";
import { BrandChip, DemoBanner, NoticeBanner, SHIELD_PATHS } from "./parts";

type Nav = NativeStackNavigationProp<MainStackParamList>;

function SectionLabel({ label }: { label: string }) {
  const { tokens } = useTheme();
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 10.5,
        letterSpacing: 10.5 * 0.08,
        textTransform: "uppercase",
        color: tokens.ink3,
      }}
    >
      {label}
    </Text>
  );
}

/** Строка способа: бренд-плитка, название, подпись и метка «Скоро».
 *  НЕ кнопка — нажимать нечего, пока платёжной системы нет. */
function MethodRow({
  gradient,
  tag,
  title,
  subtitle,
  subtitleColor,
  soonLabel,
  divider,
}: {
  gradient: [string, string];
  tag: string;
  title: string;
  subtitle: string;
  subtitleColor: string;
  soonLabel: string;
  divider: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 10,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: "rgba(23,18,67,0.07)",
        // Приглушение — это и есть «неактивно»: способ виден, но ясно, что им
        // сейчас не воспользоваться.
        opacity: 0.55,
      }}
    >
      <BrandChip gradient={gradient} label={tag} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
          {title}
        </Text>
        <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: subtitleColor }}>{subtitle}</Text>
      </View>
      <View
        style={{
          paddingHorizontal: 9,
          paddingVertical: 3,
          borderRadius: 8,
          backgroundColor: "rgba(100,116,139,0.14)",
        }}
      >
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 9.5, color: subtitleColor }}>{soonLabel}</Text>
      </View>
    </View>
  );
}

export default function PayMethodsScreen() {
  const { scheme } = useTheme();
  const { d } = useAppLocale();
  const t = d.parentApp;
  const p2 = t.pay2;
  const navigation = useNavigation<Nav>();

  const cardSubColor = scheme === "dark" ? "rgba(255,255,255,0.6)" : "rgba(26,19,74,0.6)";

  return (
    <AppBackground>
      <InnerHeader title={t.scr.payMethods} titleSize={15} onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 118 }}
      >
        <DemoBanner text={p2.demoBanner} />

        <SectionLabel label={t.pay.otherMethods} />
        <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
          {OTHER_METHODS.map((m, i) => (
            <MethodRow
              key={m.id}
              gradient={m.gradient}
              tag={m.tag}
              title={m.title}
              subtitle={p2.methodNotLinked}
              subtitleColor={cardSubColor}
              soonLabel={d.status.soon}
              divider={i > 0}
            />
          ))}
        </GlassCard>

        <NoticeBanner family="violet" paths={SHIELD_PATHS} text={p2.soon} />
      </ScrollView>
    </AppBackground>
  );
}
