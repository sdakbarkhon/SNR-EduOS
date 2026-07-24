/**
 * AuthDemoPickerSheet — «Демо-режим» (макет authSheet='demo', строки 2076–2081).
 * Список 3 демо-родителей с аватарами и стопкой мини-детей;
 * onTap → pickDemoParent → закрыть шторку + enter/picker (макет 4295).
 * У шторки нет отдельной кнопки «Закрыть» — только грип и оверлей.
 */
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BottomSheetFrame } from "../../../ui";
import { useAppLocale } from "../../../i18n";
import { fonts, gradPoints, shadowStyle, useTheme } from "../../../theme";
import { getDemoParents, getChildren } from "../../../data";
import { useAuthSession } from "../../../context/AuthSessionContext";

/** Мини-аватарки детей — градиенты берём из CHILDREN[i].avatar_gradient. */
const MINI_SIZE = 24;

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

  const parentGrads: Record<string, [string, string]> = {
    "demo-bakhtiyor": ["#34D399", "#0EA5E9"],
    "demo-sherzod": ["#60A5FA", "#2563EB"],
    "demo-dilnoza": ["#8B5CF6", "#22D3EE"],
  };

  const kidsCountLabel = (n: number) => (n === 1 ? t.kidsOne : t.kidsMany.replace("{n}", String(n)));

  return (
    <BottomSheetFrame visible={visible} onClose={onClose}>
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: tokens.ink1, paddingHorizontal: 20, paddingTop: 2 }}>
        {t.demo}
      </Text>
      <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, lineHeight: 15, color: tokens.ink2, paddingHorizontal: 20, paddingTop: 3, paddingBottom: 8 }}>
        {t.demoSub}
      </Text>
      {parents.map((p, i) => {
        const pg = parentGrads[p.id] ?? ["#8B5CF6", "#22D3EE"];
        return (
          <Pressable
            key={p.id}
            onPress={() => {
              const next = pickDemoParent(p);
              onClose();
              if (next === "app") {
                // pickDemoParent уже установил phase=app, enterApp дублирует
                // childId, чтобы MainStack получил корректного ребёнка.
                enterApp(0);
              }
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 11,
              paddingVertical: 11,
              paddingHorizontal: 20,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: "rgba(23,18,67,0.06)",
            }}
          >
            <View style={[shadowStyle({ x: 0, y: 6, blur: 14, color: `${pg[1]}55` }), { borderRadius: 22 }]}>
              <LinearGradient
                colors={pg}
                start={gr.start}
                end={gr.end}
                style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#FFFFFF" }}>
                  {p.name[0]}
                </Text>
              </LinearGradient>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>{p.name}</Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink2, marginTop: 1 }}>{p.phone}</Text>
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 9.5, color: tokens.accent, marginTop: 1 }}>
                {kidsCountLabel(p.kids_count)}
              </Text>
            </View>
            {/* Стопка мини-аватарок детей */}
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
                      marginLeft: idx === 0 ? 0 : -7,
                      borderWidth: 2,
                      borderColor: "#FFFFFF",
                    }}
                  >
                    <LinearGradient
                      colors={k.avatar_gradient}
                      start={gr.start}
                      end={gr.end}
                      style={{
                        flex: 1,
                        borderRadius: MINI_SIZE / 2,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontFamily: fonts.manrope800, fontSize: 10, color: "#FFFFFF" }}>
                        {k.first_name[0]}
                      </Text>
                    </LinearGradient>
                  </View>
                );
              })}
            </View>
          </Pressable>
        );
      })}
      <View style={{ height: 16 }} />
    </BottomSheetFrame>
  );
}

export default AuthDemoPickerSheet;
