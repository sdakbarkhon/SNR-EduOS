/**
 * AuthDemoPickerSheet — шторка «Демо-режим» (макет authSheet='demo',
 * строки 2070–2092 + фикстура demoParents 4285–4296). Вид не менялся.
 *
 * Заход 2, шаг 2: карточки — больше НЕ демо-фикстура (Бахтиёр/Шерзод/
 * Дилноза с мок-детьми). Тап по карточке = СРАЗУ реальный вход соответ-
 * ствующим тестовым аккаунтом (lib/testAccounts.ts, та же карта, что
 * резолвит ввод номера на LoginPhoneScreen) — без экрана кода вообще.
 * displayName/displayChildren в testAccounts.ts — превью ДО входа (RLS до
 * авторизации ничего не отдаст); после входа Профиль/шапка берут те же
 * данные уже через useParentData(), не через эту карту.
 *
 * Порядок блоков сверху вниз (не изменён):
 *  1. Оверлей затемнения фона (даёт BottomSheetFrame).
 *  2. Панель шторки — контейнер (даёт BottomSheetFrame).
 *  3. Handle — грипп-полоска сверху (даёт BottomSheetFrame).
 *  4. Заголовок «Выберите демо-родителя».
 *  5. Subtitle шторки.
 *  6. Список аккаунтов (3 строки: аватар + текст + стопка мини-детей).
 *  7. Нижний спейсер 16px.
 */
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BottomSheetFrame } from "../../../ui";
import { useAppLocale } from "../../../i18n";
import { fonts, gradPoints, useTheme } from "../../../theme";
import { useAuthSession } from "../../../context/AuthSessionContext";
import { listTestAccounts, type TestAccount } from "../../../lib/testAccounts";
import { REAL_CHILD_PALETTE } from "../../../lib/realChild";

/** Размер мини-аватарки ребёнка в правой стопке (макет 4294: 24×24). */
const MINI_SIZE = 24;
/** Наложение мини-аватарок (макет 4294: marginLeft: -7 у не-первой). */
const MINI_OVERLAP = -7;

/** Градиент аватара родителя по индексу карточки — те же 3 цвета, что уже
 *  используются для реальных детей в остальном приложении (lib/realChild),
 *  вместо старой демо-палитры по id фикстуры (demo-bakhtiyor/... больше не
 *  существуют). */
const PARENT_GRADIENTS: [string, string][] = REAL_CHILD_PALETTE.map(([g]) => g);

/** "+998 XX XXX XX XX" — тот же формат, что LoginPhoneScreen.formatPhone. */
function formatPhoneDisplay(nationalDigits: string): string {
  const m = nationalDigits.match(/^(\d{0,2})(\d{0,3})(\d{0,2})(\d{0,2})/);
  if (!m) return `+998 ${nationalDigits}`;
  return `+998 ${[m[1], m[2], m[3], m[4]].filter(Boolean).join(" ")}`;
}

export interface AuthDemoPickerSheetProps {
  visible: boolean;
  onClose(): void;
}

export function AuthDemoPickerSheet({ visible, onClose }: AuthDemoPickerSheetProps) {
  const { d } = useAppLocale();
  const t = d.parentApp.auth;
  const { tokens } = useTheme();
  const gr = gradPoints(135);
  const { loginAsTestAccount, authBusy } = useAuthSession();

  const accounts = listTestAccounts();

  const kidsCountLabel = (n: number): string =>
    n === 1 ? t.kidsOne : t.kidsMany.replace("{n}", String(n));

  const handlePress = async (account: TestAccount) => {
    if (authBusy) return;
    // Заход 2, шаг 2: реальный сетевой логин — успех переключает
    // AuthSessionContext.phase (app/childPicker) сам, что размонтирует эту
    // шторку вместе с LoginPhoneScreen через RootNavigator; вызывать onClose()
    // здесь не нужно и рискованно (setState на уже размонтированном
    // компоненте). При ошибке (см. authBusy/smsError в контексте) шторка
    // остаётся открытой — можно попробовать другую карточку.
    await loginAsTestAccount(account);
  };

  return (
    // Блоки 1–3: BottomSheetFrame даёт оверлей, панель и грипп-полоску.
    <BottomSheetFrame visible={visible} onClose={onClose}>
      {/* Блок 4: заголовок «Выберите демо-родителя». */}
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 14,
          color: tokens.ink1,
          paddingHorizontal: 20,
          paddingTop: 2,
        }}
      >
        {t.demo}
      </Text>

      {/* Блок 5: subtitle шторки. */}
      <Text
        style={{
          fontFamily: fonts.manrope600,
          fontSize: 10,
          lineHeight: 15,
          color: tokens.ink2,
          paddingHorizontal: 20,
          paddingTop: 3,
          paddingBottom: 8,
        }}
      >
        {t.demoSub}
      </Text>

      {/* Блок 6: список аккаунтов. */}
      <View style={{ flexDirection: "column" }}>
        {accounts.map(({ phone, account }, i) => {
          const pg = PARENT_GRADIENTS[i % PARENT_GRADIENTS.length];
          return (
            <Pressable
              key={phone}
              onPress={() => handlePress(account)}
              disabled={authBusy}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 11,
                paddingVertical: 11,
                paddingHorizontal: 20,
                opacity: authBusy ? 0.5 : 1,
                // Разделитель — тонкая линия сверху между строками (кроме первой).
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: "rgba(23,18,67,0.06)",
              }}
            >
              {/* Круглый аватар-инициал 44×44 с градиентом и белой обводкой 2px. */}
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  borderWidth: 2,
                  borderColor: "#FFFFFF",
                  overflow: "hidden",
                }}
              >
                <LinearGradient
                  colors={pg}
                  start={gr.start}
                  end={gr.end}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.manrope800,
                      fontSize: 14,
                      color: "#FFFFFF",
                    }}
                  >
                    {account.displayName.charAt(0)}
                  </Text>
                </LinearGradient>
              </View>

              {/* Блок текста: имя / телефон / фиолетовая подпись про детей. */}
              <View style={{ flex: 1, flexDirection: "column", gap: 1 }}>
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 12.5,
                    color: tokens.ink1,
                  }}
                >
                  {account.displayName}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.manrope600,
                    fontSize: 9.5,
                    color: tokens.ink2,
                  }}
                >
                  {formatPhoneDisplay(phone)}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.manrope700,
                    fontSize: 9.5,
                    color: tokens.accent,
                  }}
                >
                  {kidsCountLabel(account.displayChildren.length)}
                </Text>
              </View>

              {/* Стопка мини-аватарок детей (24×24 с наложением -7px и белой рамкой). */}
              <View style={{ flexDirection: "row" }}>
                {account.displayChildren.map((child, idx) => {
                  const [kg] = REAL_CHILD_PALETTE[idx % REAL_CHILD_PALETTE.length];
                  return (
                    <View
                      key={`${child.name}-${idx}`}
                      style={{
                        width: MINI_SIZE,
                        height: MINI_SIZE,
                        borderRadius: MINI_SIZE / 2,
                        marginLeft: idx === 0 ? 0 : MINI_OVERLAP,
                        borderWidth: 2,
                        borderColor: "#FFFFFF",
                        overflow: "hidden",
                      }}
                    >
                      <LinearGradient
                        colors={kg}
                        start={gr.start}
                        end={gr.end}
                        style={{
                          flex: 1,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: fonts.manrope800,
                            fontSize: 9,
                            color: "#FFFFFF",
                          }}
                        >
                          {child.name.charAt(0)}
                        </Text>
                      </LinearGradient>
                    </View>
                  );
                })}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Блок 7: нижний спейсер 16px (макет 2090). */}
      <View style={{ height: 16 }} />
    </BottomSheetFrame>
  );
}

export default AuthDemoPickerSheet;
