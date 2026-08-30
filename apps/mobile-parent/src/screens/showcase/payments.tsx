/**
 * Три экрана оплат витрины: Checkout (#19), «Детали карты» и «Добавить карту».
 *
 * ПОЧЕМУ ОНИ ВЕРНУЛИСЬ. Все три были удалены 15.08.2026 как формы-обманки:
 * настоящему родителю они предлагали действия, которых система не делает.
 * В показе они нужны — макет их рисует, и без них раздел оплат обрывается.
 * У настоящего родителя их по-прежнему нет: маршруты закрыты demoOr.
 *
 * ФОРМА КАРТЫ ПОКАЗЫВАЕТСЯ БЕЗ ПОЛЕЙ ВВОДА — сознательное расхождение с
 * макетом, и вот почему. В макете «Добавить карту» — четыре живых поля:
 * номер (inputmode=numeric), срок, CVV (type=password) и имя держателя, а
 * под ними подпись «Данные карты не хранятся в приложении — они передаются
 * напрямую платёжному провайдеру по защищённому каналу». На телефоне это
 * рабочая форма с клавиатурой, и подпись не предупреждает, а УСПОКАИВАЕТ:
 * человек, которому показывают приложение, может принять её всерьёз и ввести
 * номер настоящей карты. Никакого провайдера за ней нет.
 *
 * Поэтому здесь:
 *  · поля — не TextInput, а строки с заведомо демонстрационными значениями;
 *    клавиатуру открыть нечем;
 *  · подпись макета про «защищённый канал» НЕ воспроизведена — вместо неё
 *    прямая: это показ, ничего не вводится и никуда не уходит, настоящие
 *    реквизиты вводить не нужно;
 *  · кнопка «Добавить карту» ничего не добавляет и говорит об этом.
 *
 * Так виден весь макет экрана и при этом нечего ввести по ошибке.
 */
import { ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, useTheme } from "../../theme";
import { GlassCard, InnerHeader, SectionHeader, StatusChip } from "../../ui";
import { LinearGradient } from "expo-linear-gradient";
import { getCardDetail, getDueBills, getDueTotal } from "../../data";
import { MAIN_CARD, OTHER_CARDS } from "../../data/demoPayments";
import { formatMoney } from "../../lib/format";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/** Строка «подпись — значение», общая для всех трёх экранов. */
function Row({ label, value, first }: { label: string; value: string; first: boolean }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 11,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: "rgba(23,18,67,0.07)",
      }}
    >
      <Text style={{ width: 116, fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink3 }}>{label}</Text>
      <Text style={{ flex: 1, fontFamily: fonts.manrope700, fontSize: 11.5, color: tokens.ink1 }}>{value}</Text>
    </View>
  );
}

/** Заметка «это показ» — одинаковая рамка на всех трёх экранах. */
function PreviewNote({ text }: { text: string }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 14,
        backgroundColor: tokens.chip(tokens.status.orange.rgb).bg,
        borderWidth: 1,
        borderColor: tokens.chip(tokens.status.orange.rgb).border,
      }}
    >
      <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, lineHeight: 16, color: tokens.status.orange.text }}>
        {text}
      </Text>
    </View>
  );
}

/** Кнопка, которая ничего не делает и не притворяется. */
function InertButton({ label, tone }: { label: string; tone: "accent" | "danger" | "ghost" }) {
  const { tokens } = useTheme();
  const цвет = tone === "danger" ? tokens.status.red.text : tone === "ghost" ? tokens.ink1 : tokens.accent;
  return (
    <GlassCard radius={16} contentStyle={{ padding: 13, alignItems: "center" }}>
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: цвет }}>{label}</Text>
    </GlassCard>
  );
}

/* ═══════════════════════ Экран 19 — Checkout ═══════════════════════ */

export function CheckoutScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const sc = t.showcase;
  const navigation = useNavigation<Nav>();

  // Сумма и состав — из тех же счетов, что и на экране «Счета к оплате».
  const bills = getDueBills(locale);
  const total = getDueTotal();
  // Способы оплаты — те же карты, что на экране «Способы оплаты»: берём их
  // из общей заготовки, а не заводим свой список.

  return (
    <AppBackground>
      <InnerHeader title={t.pay.chooseMethod} titleSize={15} onBackPress={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 118, gap: 11 }}
      >
        <LinearGradient
          colors={["#7c3aed", "#4f6df5"]}
          {...gradPoints(135)}
          style={{ borderRadius: 20, padding: 16, gap: 4 }}
        >
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 9,
              letterSpacing: 9 * 0.08,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.8)",
            }}
          >
            {t.pay.dueNow}
          </Text>
          <Text style={{ fontFamily: fonts.unbounded700, fontSize: 24, color: "#FFFFFF" }}>
            {`${formatMoney(total)} ${t.pay.sum}`}
          </Text>
          <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: "rgba(255,255,255,0.9)" }}>
            {bills.map((b) => b.title).join(" · ")}
          </Text>
        </LinearGradient>

        <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          {bills.map((b, i) => (
            <Row key={b.id} label={b.title} value={`${formatMoney(b.amount)} ${t.pay.sum}`} first={i === 0} />
          ))}
        </GlassCard>

        <SectionHeader title={t.pay.chooseMethod} />
        <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          <Row label={MAIN_CARD.brand} value={MAIN_CARD.masked} first />
          {OTHER_CARDS.map((c) => (
            <Row key={c.id} label={c.brand} value={c.masked} first={false} />
          ))}
        </GlassCard>

        <PreviewNote text={sc.formPreviewNote} />
        <InertButton label={`${t.pay.payNow} ${formatMoney(total)} ${t.pay.sum}`} tone="accent" />
      </ScrollView>
    </AppBackground>
  );
}

/* ═══════════════════════ Детали карты ═══════════════════════ */

export function CardDetailsScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const sc = t.showcase;
  const navigation = useNavigation<Nav>();
  const card = getCardDetail(locale);

  const FACT_LABEL: Record<string, string> = {
    cardSystem: sc.cardSystem,
    cardType: sc.cardType,
    cardBank: sc.cardBank,
    cardStatus: sc.cardStatus,
  };

  return (
    <AppBackground>
      <InnerHeader title={t.pay.mainCard} titleSize={15} onBackPress={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 118, gap: 11 }}
      >
        {/* Сама карта — маскированный номер, как в макете. */}
        <LinearGradient
          colors={["#334155", "#0f172a"]}
          {...gradPoints(135)}
          style={{ borderRadius: 20, padding: 18, gap: 14 }}
        >
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
            {card.brand}
          </Text>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 17, letterSpacing: 1.5, color: "#FFFFFF" }}>
            {card.masked}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ flex: 1, fontFamily: fonts.manrope700, fontSize: 11, color: "rgba(255,255,255,0.9)" }}>
              {card.holder}
            </Text>
            <Text style={{ fontFamily: fonts.manrope700, fontSize: 11, color: "rgba(255,255,255,0.9)" }}>
              {card.valid_thru}
            </Text>
          </View>
        </LinearGradient>

        <SectionHeader title={sc.aboutInfo} />
        <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          {card.facts.map((f, i) => (
            <Row key={f.label_key} label={FACT_LABEL[f.label_key] ?? f.label_key} value={f.value} first={i === 0} />
          ))}
        </GlassCard>

        <SectionHeader title={t.set.security} />
        <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          <Row label={t.pay.mainCard} value={t.pay.on} first />
          <Row label={t.pay.autopay} value={t.pay.on} first={false} />
        </GlassCard>

        <SectionHeader title={sc.cardLastPaymentsCap} linkLabel={`${t.common.viewAll} ›`} onPress={() => navigation.navigate("d20")} />
        <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          {card.last_payments.map((p, i) => (
            <View
              key={p.name}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 11,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: "rgba(23,18,67,0.07)",
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
                  {p.name}
                </Text>
                <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink3 }}>{p.date_label}</Text>
              </View>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
                {formatMoney(p.amount)}
              </Text>
            </View>
          ))}
        </GlassCard>

        <PreviewNote text={sc.cardPreviewNote} />
        <InertButton label={sc.deleteCard} tone="danger" />
      </ScrollView>
    </AppBackground>
  );
}

/* ═══════════════════════ Добавить карту ═══════════════════════ */

export function AddCardScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const sc = t.showcase;
  const navigation = useNavigation<Nav>();
  const card = getCardDetail(locale);

  // ПОЛЯ — НЕ ВВОД. Значения демонстрационные и взяты у той же карты, что на
  // экране деталей: номер маскирован, CVV показан точками. Ввести сюда
  // нечего — это ровно то, ради чего форма и переделана (см. шапку файла).
  const поля: [string, string][] = [
    [sc.cardNumberCap, card.masked],
    [sc.cardExpiryCap, card.valid_thru],
    [sc.cardCvvCap, "•••"],
    [sc.cardHolderCap, card.holder],
  ];

  return (
    <AppBackground>
      <InnerHeader title={sc.addCard} titleSize={15} onBackPress={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 118, gap: 11 }}
      >
        {/* Предупреждение — ПЕРВЫМ, до карточки: его должны прочитать раньше,
            чем увидят форму. */}
        <PreviewNote text={sc.cardPreviewNote} />

        <LinearGradient
          colors={["#334155", "#0f172a"]}
          {...gradPoints(135)}
          style={{ borderRadius: 20, padding: 18, gap: 14 }}
        >
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
            {card.brand}
          </Text>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 17, letterSpacing: 1.5, color: "#FFFFFF" }}>
            {card.masked}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ flex: 1, fontFamily: fonts.manrope700, fontSize: 11, color: "rgba(255,255,255,0.9)" }}>
              {card.holder}
            </Text>
            <Text style={{ fontFamily: fonts.manrope700, fontSize: 11, color: "rgba(255,255,255,0.9)" }}>
              {card.valid_thru}
            </Text>
          </View>
        </LinearGradient>

        <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          {поля.map(([label, value], i) => (
            <Row key={label} label={label} value={value} first={i === 0} />
          ))}
        </GlassCard>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 2 }}>
          <StatusChip label={sc.makeMainCard} family="violet" />
        </View>

        <InertButton label={sc.addCard} tone="ghost" />
      </ScrollView>
    </AppBackground>
  );
}
