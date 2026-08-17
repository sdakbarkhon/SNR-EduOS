/**
 * Заход 4a — LoginSmsScreen (макет layerA3, «SNR EduOS v2 Light.dc.html» стр. 2020–2043).
 * Строгий block-list (сверху вниз):
 *   1. Шапка (back + resend-таймер справа) — 50/18/8.
 *   2. Заголовок «Введите код\nиз SMS» — Unbounded 20/600.
 *   3. Subtitle «Мы отправили 4-значный код\nна номер {phone}».
 *   4. 4 бокса ввода кода (центрированы, gap 10).
 *   5. Security-стрип (glass, щит 32×32 + текст двумя строками).
 *   6. Spacer (flex:1) — прижимает клавиатуру к низу.
 *   7. Numeric keypad 3×4 (padKeys — 12 клавиш).
 *
 * Реальный таймер cooldown (45→0). Автоверификация при 4 цифрах (setTimeout 350ms).
 *
 * ЗАХОД 1 (реальный вход): verifyCode() теперь асинхронна (сверяет код
 * с ожидаемым для найденного номера, затем настоящий signInWithPassword
 * через loginAsParent) — сама решает переход фазы внутри AuthSessionContext,
 * этот экран больше не зовёт enterApp() напрямую. Неверный код/сбой сети —
 * smsError из контекста, отображается под боксами + красная рамка боксов
 * (существовавшего компонента ошибки в этих экранах не было — минимальный
 * inline-Text на существующем tokens.status.red, вид остальных блоков
 * не менялся).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppLocale } from "../../i18n";
import { useTheme, fonts, shadowStyle } from "../../theme";
import { GlassCard, GlassCircleButton } from "../../ui";
import { useAuthSession } from "../../context/AuthSessionContext";
import { BackArrowIcon, BackspaceIcon, ShieldCheckIcon } from "../../ui/auth/icons";

const SMS_LEN = 4;
const RESEND_COOLDOWN = 45;
const AUTO_SUBMIT_DELAY = 350;

interface PadKey {
  d: string;
  l: string;
}

const PAD_KEYS: PadKey[] = [
  { d: "1", l: "" },
  { d: "2", l: "ABC" },
  { d: "3", l: "DEF" },
  { d: "4", l: "GHI" },
  { d: "5", l: "JKL" },
  { d: "6", l: "MNO" },
  { d: "7", l: "PQRS" },
  { d: "8", l: "TUV" },
  { d: "9", l: "WXYZ" },
  { d: "", l: "" },
  { d: "0", l: "" },
  { d: "del", l: "" },
];

export function LoginSmsScreen() {
  const { d } = useAppLocale();
  const t = d.parentApp.auth;
  const { tokens, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    phone,
    country,
    smsCode,
    setSmsCode,
    verifyCode,
    resendCode,
    setPhase,
    smsError,
    authBusy,
    smsAttemptsLeft,
    smsOk,
  } = useAuthSession();

  const [cooldown, setCooldown] = useState<number>(RESEND_COOLDOWN);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // «+998 90 123 45 67» — формат тот же, что в LoginPhoneScreen.
  const phoneMasked = useMemo(() => {
    const parts = phone.match(/^(\d{0,2})(\d{0,3})(\d{0,2})(\d{0,2})/);
    if (!parts) return `${country} ${phone || t.phonePlaceholder}`;
    const rest = [parts[1], parts[2], parts[3], parts[4]].filter(Boolean).join(" ");
    return `${country} ${rest || t.phonePlaceholder}`;
  }, [phone, country, t.phonePlaceholder]);

  // Таймер cooldown (макет — smsТ 45 → 0).
  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldown > 0]);

  // Автоотправка — РОВНО ОДИН раз на один набранный код.
  //
  // Что было сломано. Условие смотрело только «в поле 4 цифры и мы не заняты».
  // После неверного кода поле оставалось заполненным, authBusy возвращался в
  // false — и эффект тут же назначал новую проверку. Одна опечатка съедала
  // подряд все пять попыток кода, и человек оставался без входа, ничего для
  // этого не сделав.
  //
  // Как стало. Отправляем только на ПЕРЕХОДЕ с неполного кода на полный.
  // Повторные прогоны эффекта (authBusy туда-обратно, приезд ошибки) видят,
  // что длина не менялась, и молчат. Контекст вдобавок чистит поле на ошибке,
  // так что следующая проверка возможна только после нового набора.
  const prevLenRef = useRef(0);
  useEffect(() => {
    const prevLen = prevLenRef.current;
    prevLenRef.current = smsCode.length;
    if (smsCode.length !== SMS_LEN || prevLen === SMS_LEN) return;
    if (authBusy) return;
    autoSubmitRef.current = setTimeout(() => {
      void verifyCode();
    }, AUTO_SUBMIT_DELAY);
    return () => {
      if (autoSubmitRef.current) clearTimeout(autoSubmitRef.current);
    };
  }, [smsCode, authBusy, verifyCode]);

  // ── Анимации ячеек: тряска на ошибке, пульс на проверке ──────────────────
  // Всё на Animated из react-native — новых модулей не добавляем.
  const shake = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!smsError) return;
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0.6, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  }, [smsError, shake]);

  useEffect(() => {
    if (!authBusy) { pulse.stopAnimation(); pulse.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 480, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 480, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [authBusy, pulse]);

  // Заход 1: во время authBusy verifyCode() уже улетел в сеть (реальный
  // signInWithPassword + загрузка детей) и САМ переключит фазу по готовности
  // — если пользователь успеет уйти назад до этого момента, поздний setState
  // из уже висящего запроса неожиданно перепрыгнет его обратно вперёд.
  // Блокируем оба выхода из экрана, пока запрос в полёте.
  const goBack = () => {
    if (authBusy) return;
    setPhase("phone");
  };

  const smsResend = () => {
    if (cooldown > 0 || authBusy) return;
    setSmsCode("");
    setCooldown(RESEND_COOLDOWN);
  };

  const pressPad = (k: string) => {
    if (!k || authBusy) return;
    if (k === "del") {
      setSmsCode(smsCode.slice(0, -1));
      return;
    }
    if (smsCode.length >= SMS_LEN) return;
    setSmsCode(smsCode + k);
  };

  // Повтор запрещён, пока идёт проверка И пока код уже набран целиком: выдача
  // нового кода гасит старый, а проверка в этот момент возьмёт свежую строку и
  // сравнит с ней ТО, что человек ввёл раньше. Он потерял бы попытку у кода,
  // которого даже не видел.
  const resendBlocked = authBusy || smsCode.length === SMS_LEN;

  /** Выслать код заново: чистим поле и заводим отсчёт, иначе шапка показывает
   *  протухший таймер, а полное поле блокирует автоотправку нового кода. */
  async function handleResend() {
    if (resendBlocked) return;
    const ok = await resendCode();
    if (!ok) return;
    setSmsCode("");
    setCooldown(RESEND_COOLDOWN);
  }

  const smsResendActive = cooldown === 0;
  const smsResendTxt = cooldown > 0
    ? t.smsResendCountdown.replace("{sec}", String(cooldown).padStart(2, "0"))
    : t.smsResend;

  // ── Токены цветов боксов / клавиш ─────────────────────────────────────────
  const glassBg = scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)";
  const glassBorder = scheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.8)";
  const activeBorder = "rgba(124,58,237,0.65)";
  // Заход 1: цвет ошибки — существующий семантический токен status.red
  // (уже используется для просроченных ДЗ и т.п.), новых цветов не вводим.
  const errorColor = tokens.status.red.text;
  const SMS_ERROR_TEXT: Record<string, string> = {
    wrongCode: t.codeWrong,
    expired: t.codeExpired,
    tooMany: t.codeTooMany,
    loginFailed: t.loginFailed,
  };
  const smsErrorText = smsError ? (SMS_ERROR_TEXT[smsError] ?? t.loginFailed) : null;

  // Цвета состояний ячейки. Зелёный — тот же семантический токен, что у
  // «сдано вовремя»; своих цветов не заводим.
  const okColor = tokens.status.green.text;
  const filledBorder = scheme === "dark" ? "rgba(255,255,255,0.34)" : "rgba(23,18,67,0.26)";

  // Сколько попыток осталось. Показываем только когда счётчик реально пришёл
  // с сервера — выдумывать число нельзя, а после погашенного кода его нет.
  const attemptsText =
    smsAttemptsLeft == null || smsAttemptsLeft <= 0
      ? null
      : smsAttemptsLeft === 1
        ? t.codeLastAttempt
        : t.codeAttemptsLeft.replace("{n}", String(smsAttemptsLeft));

  const statusTextStyle = (color: string) => ({
    fontFamily: fonts.manrope700,
    fontSize: 11,
    color,
    textAlign: "center" as const,
  });

  return (
    <View style={{ flex: 1 }}>
      {/* ── БЛОК 1: Шапка (back + resend-таймер справа) ─────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingTop: Math.max(50, insets.top + 10),
          paddingHorizontal: 18,
          paddingBottom: 8,
        }}
      >
        <GlassCircleButton onPress={goBack}>
          <BackArrowIcon color={tokens.ink1} />
        </GlassCircleButton>
        <View style={{ flex: 1 }} />
        <Pressable onPress={smsResend} disabled={!smsResendActive} hitSlop={10}>
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 11.5,
              color: smsResendActive ? tokens.accent : tokens.ink3,
            }}
          >
            {smsResendTxt}
          </Text>
        </Pressable>
      </View>

      {/* ── flex:1 колонка контента (padding 8 20 0) ─────────────────────── */}
      <View
        style={{
          flex: 1,
          minHeight: 0,
          flexDirection: "column",
          gap: 12,
          paddingHorizontal: 20,
          paddingTop: 8,
        }}
      >
        {/* ── БЛОК 2: Заголовок ──────────────────────────────────────────── */}
        <Text
          style={{
            fontFamily: fonts.unbounded600,
            fontSize: 20,
            lineHeight: 27,
            color: tokens.ink1,
          }}
        >
          {t.smsTitle}
        </Text>

        {/* ── БЛОК 3: Subtitle ──────────────────────────────────────────── */}
        <Text
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 11.5,
            lineHeight: 17,
            color: tokens.ink2,
          }}
        >
          {t.smsSubPrefix}
          <Text style={{ fontFamily: fonts.manrope800, color: tokens.ink1 }}>{phoneMasked}</Text>
        </Text>

        {/* ── БЛОК 4: 4 бокса ввода кода ────────────────────────────────── */}
        {/* authBusy — единственная (минимальная, вне block-list) визуальная
            обратная связь на время реального сетевого логина: без неё экран
            выглядит зависшим на несколько сотен мс между вводом 4-й цифры
            и переходом дальше. */}
        <Animated.View
          style={{
            flexDirection: "row",
            gap: 10,
            justifyContent: "center",
            paddingVertical: 6,
            transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] }) }],
          }}
        >
          {Array.from({ length: SMS_LEN }).map((_, i) => {
            const digit = smsCode[i] ?? "";
            const filled = digit !== "";
            // Куда пойдёт следующая цифра — видно и до, и после ошибки.
            const isNext = !smsError && !smsOk && smsCode.length === i;
            const borderColor = smsOk
              ? okColor
              : smsError
                ? errorColor
                : isNext
                  ? activeBorder
                  : filled
                    ? filledBorder
                    : glassBorder;
            return (
              <Animated.View
                key={i}
                style={[
                  {
                    width: 56,
                    height: 60,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: glassBg,
                    borderWidth: isNext || filled || smsError || smsOk ? 2 : 1,
                    borderColor,
                    // Во время проверки ячейки мягко дышат — экран не выглядит
                    // замершим, пока ответ идёт по сети.
                    opacity: authBusy
                      ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] })
                      : 1,
                  },
                  shadowStyle(
                    isNext
                      ? { x: 0, y: 10, blur: 24, color: "rgba(124,58,237,0.2)" }
                      : { x: 0, y: 8, blur: 18, color: "rgba(99,86,214,0.1)" },
                  ),
                ]}
              >
                <Text
                  style={{
                    fontFamily: fonts.unbounded600,
                    fontSize: 20,
                    color: smsOk ? okColor : tokens.ink1,
                  }}
                >
                  {digit}
                </Text>
                {/* Пустая ячейка, куда пойдёт следующая цифра, помечена точкой —
                    иначе непонятно, где сейчас каретка. */}
                {!filled && isNext ? (
                  <View
                    style={{
                      position: "absolute",
                      bottom: 12,
                      width: 14,
                      height: 2,
                      borderRadius: 1,
                      backgroundColor: tokens.accent,
                    }}
                  />
                ) : null}
              </Animated.View>
            );
          })}
        </Animated.View>

        {/* Состояние проверки: «проверяем» → «принят» → причина отказа.
            Высота строки постоянная, чтобы блок не прыгал. */}
        <View style={{ minHeight: 34, justifyContent: "center" }}>
          {authBusy ? (
            <Text style={statusTextStyle(tokens.ink2)}>{t.codeChecking}</Text>
          ) : smsOk ? (
            <Text style={statusTextStyle(okColor)}>{t.codeAccepted}</Text>
          ) : smsErrorText ? (
            <>
              <Text style={statusTextStyle(errorColor)}>{smsErrorText}</Text>
              {attemptsText ? (
                <Text style={[statusTextStyle(tokens.ink3), { fontSize: 10.5, marginTop: 2 }]}>
                  {attemptsText}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>

        {/* SMS пока не отправляются — провайдера нет. Честно говорим об этом
            и даём запросить код заново; сервер сам не даст чаще раза в
            минуту. Строка уйдёт вместе с заглушкой доставки. */}
        <Text
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 10.5,
            color: tokens.ink3,
            textAlign: "center",
          }}
        >
          {t.codeFromSchool}
        </Text>
        {/* Пока код выдаётся заново — говорим об этом прямо в ссылке, а не
            гасим её молча: выдача идёт через сеть и занимает время. */}
        <Pressable
          onPress={() => { void handleResend(); }}
          disabled={resendBlocked}
          style={({ pressed }) => ({ opacity: pressed && !resendBlocked ? 0.6 : 1 })}
        >
          <Text
            style={{
              fontFamily: fonts.manrope700,
              fontSize: 11,
              color: resendBlocked ? tokens.ink3 : tokens.ink2,
              textAlign: "center",
              textDecorationLine: resendBlocked ? "none" : "underline",
            }}
          >
            {authBusy ? t.sendingCode : t.resendCode}
          </Text>
        </Pressable>

        {/* ── БЛОК 5: Security-стрип (щит + текст двумя строками) ───────── */}
        <GlassCard
          radius={16}
          contentStyle={{
            padding: 11,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(139,92,246,0.14)",
              borderWidth: 1,
              borderColor: "rgba(139,92,246,0.35)",
            }}
          >
            <ShieldCheckIcon size={15} color="#6D28D9" />
          </View>
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.manrope600,
              fontSize: 10.5,
              lineHeight: 16,
              color: tokens.ink2,
            }}
          >
            {t.smsSecurity}
          </Text>
        </GlassCard>

        {/* ── БЛОК 6: Spacer (flex:1) — прижимает клавиатуру ────────────── */}
        <View style={{ flex: 1 }} />

        {/* ── БЛОК 7: Numeric keypad 3×4 (padKeys, gap 8) ──────────────── */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            rowGap: 8,
            paddingBottom: Math.max(26, insets.bottom + 12),
          }}
        >
          {PAD_KEYS.map((k, i) => {
            const empty = k.d === "";
            const isDel = k.d === "del";
            return (
              <Pressable
                key={i}
                onPress={() => pressPad(k.d)}
                disabled={empty}
                style={{
                  width: "32%",
                  height: 46,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: empty ? "transparent" : glassBg,
                  borderWidth: empty ? 0 : 1,
                  borderColor: glassBorder,
                  opacity: empty ? 0 : 1,
                }}
              >
                {isDel ? (
                  <BackspaceIcon size={20} color={tokens.ink1} />
                ) : (
                  <>
                    <Text
                      style={{
                        fontFamily: fonts.manrope800,
                        fontSize: 18,
                        lineHeight: 20,
                        color: tokens.ink1,
                      }}
                    >
                      {k.d}
                    </Text>
                    {k.l ? (
                      <Text
                        style={{
                          fontFamily: fonts.manrope800,
                          fontSize: 7.5,
                          letterSpacing: 0.6,
                          color: tokens.ink3,
                          marginTop: 1,
                        }}
                      >
                        {k.l}
                      </Text>
                    ) : null}
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default LoginSmsScreen;
