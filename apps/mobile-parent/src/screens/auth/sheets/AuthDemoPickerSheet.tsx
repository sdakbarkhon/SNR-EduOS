/**
 * AuthDemoPickerSheet — шторка «Выберите демо-родителя» (макет authSheet='demo',
 * строки 2070–2092 + фикстура demoParents 4285–4296).
 *
 * Порядок блоков сверху вниз (заход 4a):
 *  1. Оверлей затемнения фона (даёт BottomSheetFrame).
 *  2. Панель шторки — контейнер (даёт BottomSheetFrame).
 *  3. Handle — грипп-полоска сверху (даёт BottomSheetFrame).
 *  4. Заголовок «Выберите демо-родителя».
 *  5. Subtitle шторки.
 *  6. Список демо-родителей (3 строки: аватар + текст + стопка мини-детей).
 *  7. Нижний спейсер 16px.
 *
 * Тап по строке → pickDemoParent(): 1-детный сразу входит в приложение,
 * многодетный переводит в фазу picker (макет 4295).
 */
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BottomSheetFrame } from "../../../ui";
import { useAppLocale } from "../../../i18n";
import { fonts, gradPoints, useTheme } from "../../../theme";
import { getChildren, getDemoParents } from "../../../data";
import { useAuthSession } from "../../../context/AuthSessionContext";

/** Размер мини-аватарки ребёнка в правой стопке (макет 4294: 24×24). */
const MINI_SIZE = 24;
/** Наложение мини-аватарок (макет 4294: marginLeft: -7 у не-первой). */
const MINI_OVERLAP = -7;

/** Градиенты аватара по id демо-родителя (макет 4286–4288 колонка `g`). */
const DEMO_AVATAR_GRADS: Record<string, [string, string]> = {
  "demo-bakhtiyor": ["#34D399", "#0EA5E9"],
  "demo-sherzod": ["#60A5FA", "#2563EB"],
  "demo-dilnoza": ["#8B5CF6", "#22D3EE"],
};

export interface AuthDemoPickerSheetProps {
  visible: boolean;
  onClose(): void;
}

export function AuthDemoPickerSheet({ visible, onClose }: AuthDemoPickerSheetProps) {
  const { d } = useAppLocale();
  const t = d.parentApp.auth;
  const { tokens } = useTheme();
  const gr = gradPoints(135);
  const { pickDemoParent, enterApp } = useAuthSession();

  const parents = getDemoParents();
  const kids = getChildren();

  const kidsCountLabel = (n: number): string =>
    n === 1 ? t.kidsOne : t.kidsMany.replace("{n}", String(n));

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

      {/* Блок 6: список демо-родителей. */}
      <View style={{ flexDirection: "column" }}>
        {parents.map((p, i) => {
          const pg = DEMO_AVATAR_GRADS[p.id] ?? ["#8B5CF6", "#22D3EE"];
          return (
            <Pressable
              key={p.id}
              onPress={() => {
                const next = pickDemoParent(p);
                onClose();
                // 1-детный демо-родитель сразу входит в приложение (макет 4295).
                if (next === "app") enterApp(0);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 11,
                paddingVertical: 11,
                paddingHorizontal: 20,
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
                    {p.name.charAt(0)}
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
                  {p.name}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.manrope600,
                    fontSize: 9.5,
                    color: tokens.ink2,
                  }}
                >
                  {p.phone}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.manrope700,
                    fontSize: 9.5,
                    color: tokens.accent,
                  }}
                >
                  {kidsCountLabel(p.kids_count)}
                </Text>
              </View>

              {/* Стопка мини-аватарок детей (24×24 с наложением -7px и белой рамкой). */}
              <View style={{ flexDirection: "row" }}>
                {p.child_ids.map((cid, idx) => {
                  const k = kids.find((c) => c.id === cid);
                  if (!k) return null;
                  return (
                    <View
                      key={cid}
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
                        colors={k.avatar_gradient}
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
                          {k.first_name.charAt(0)}
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
