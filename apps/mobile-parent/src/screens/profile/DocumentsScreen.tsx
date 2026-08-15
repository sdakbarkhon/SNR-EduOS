/**
 * Экран #31 «Документы» — REBUILD (Заход 7, block-by-block из макета).
 *
 * Композиция 1:1 из «SNR EduOS v2 Light.dc.html», строки 1247–1274 (РОВНО
 * 9 визуальных блоков; ни таб-фильтров, ни поиска, ни drag&drop-аплоада,
 * ни превью-PDF, ни свайп-действий, ни empty-state — их в макете НЕТ):
 *
 *  1. Шапка (InnerHeader) — back слева, «Документы» Unbounded 15/600 в центре,
 *     kebab-меню (три точки) справа → stub 'profmenu'.
 *  2. Scroll-контейнер: gap 12, padding 4/18/118/18 под FloatingTabBar.
 *  3. Security-баннер — зелёная стеклоплашка (rgba(16,185,129,.10)/.30 border)
 *     с иконкой «shield-check» и двумя строками: «Мы защищаем ваши данные» +
 *     подтекст про шифрование.
 *  4. SectionLabel uppercase «ДОКУМЕНТЫ РЕБЁНКА» (10.5/800, letterSpacing .08em).
 *  5. GlassCard-list — строки из getChildDocuments(): 36×36 gradient-плитка с
 *     doc-иконкой + name + subtitle + шеврон. Клик по «Медицинская справка» /
 *     «Прививки» → dmed (Медкарта); остальные → stub 'file' (просмотр файла) —
 *     маппинг задокументирован в fixtures/profile.ts::DOCUMENTS.
 *  6. SectionLabel uppercase «ДОКУМЕНТЫ РОДИТЕЛЯ».
 *  7. GlassCard-list — строки из getParentDocuments(); клик → stub 'file'.
 *  8. PrimaryButton «Добавить документ» с плюсом → stub 'adddoc'.
 *  9. Футнот «Поддерживаются файлы: PDF, JPG, PNG (до 10 МБ)» — 9/600 ink3,
 *     text-align center.
 *
 * Данные — только через аксессоры src/data. Тексты, для которых в словаре
 * нет ключей (баннер, section-label'ы, кнопка, футнот), задаются здесь
 * строкой ru — соответствует практике других d-экранов до подключения
 * i18n-ключей на этапе перевода. Обе темы через tokens.
 *
 * 15.08.2026 (заглушки). Сверху — плашка «данных нет, это пример»: документов
 * родителя в базе школы нет, список собран из фикстуры.
 */
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  GlassCard,
  GlassCircleButton,
  InnerHeader,
  PrimaryButton,
} from "../../ui";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme, type ThemeTokens } from "../../theme";
import { useAppLocale } from "../../i18n";
import { getChildDocuments, getParentDocuments } from "../../data";
import type { DocumentRow } from "../../data";
import type { MainStackParamList } from "../../navigation/routes";
import { DemoBanner } from "../../ui/notices";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/** Иконка doc-24 (белый глиф на градиенте плитки строки, как ICONS.doc
 *  из routes.ts). Общая для всех строк — специфических owner/name-иконок
 *  в фикстуре DocumentRow нет. */
const DOC_ICON_PATHS = [
  "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z",
  "M14 3v5h5",
  "M9 13h6",
  "M9 17h4",
];

/** Родительский экспорт. */
export default function DocumentsScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();

  const childDocs = getChildDocuments();
  const parentDocs = getParentDocuments();

  // Роутинг кликов по строкам (см. fixtures/profile.ts коммент к DOCUMENTS).
  const openChildDoc = (doc: DocumentRow) => () => {
    if (doc.name === "Медицинская справка" || doc.name === "Прививки") {
      navigation.navigate("dmed");
    } else {
      navigation.navigate("stub", { stubKey: "file" });
    }
  };
  const openParentDoc = () => navigation.navigate("stub", { stubKey: "file" });
  const openAddDoc = () => navigation.navigate("stub", { stubKey: "adddoc" });
  const openProfMenu = () => navigation.navigate("stub", { stubKey: "profmenu" });

  return (
    <AppBackground>
      {/* 1. Шапка dhub. */}
      <InnerHeader
        title={d.parentApp.scr.documents}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={openProfMenu}>
            <Svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke={tokens.ink1}
              strokeWidth={2.2}
              strokeLinecap="round"
            >
              <Path d="M5 12h.01" />
              <Path d="M12 12h.01" />
              <Path d="M19 12h.01" />
            </Svg>
          </GlassCircleButton>
        }
      />

      {/* 2. Скролл-контейнер (paddingBottom 118 под FloatingTabBar). */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 4,
          paddingHorizontal: 18,
          paddingBottom: 118,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Плашка «это пример» — раздела ещё нет в базе школы. */}
        <DemoBanner text={d.parentApp.soon.sections.documents} />

        {/* 3. Security-баннер (макет 1254–1257). */}
        <SecurityBanner tokens={tokens} />

        {/* 4. SectionLabel «ДОКУМЕНТЫ РЕБЁНКА». */}
        <SectionLabel text="ДОКУМЕНТЫ РЕБЁНКА" tokens={tokens} />

        {/* 5. Карточка-список документов ребёнка. */}
        <GlassCard
          radius={20}
          contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}
        >
          {childDocs.map((doc, i) => (
            <DocRow
              key={`c-${doc.name}-${i}`}
              doc={doc}
              divider={i > 0}
              onPress={openChildDoc(doc)}
              tokens={tokens}
              scheme={scheme}
            />
          ))}
        </GlassCard>

        {/* 6. SectionLabel «ДОКУМЕНТЫ РОДИТЕЛЯ». */}
        <SectionLabel text="ДОКУМЕНТЫ РОДИТЕЛЯ" tokens={tokens} />

        {/* 7. Карточка-список документов родителя. */}
        <GlassCard
          radius={20}
          contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}
        >
          {parentDocs.map((doc, i) => (
            <DocRow
              key={`p-${doc.name}-${i}`}
              doc={doc}
              divider={i > 0}
              onPress={openParentDoc}
              tokens={tokens}
              scheme={scheme}
            />
          ))}
        </GlassCard>

        {/* 8. Primary CTA «Добавить документ». */}
        <PrimaryButton
          label="Добавить документ"
          onPress={openAddDoc}
          icon={
            <Svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth={2.2}
              strokeLinecap="round"
            >
              <Path d="M12 5v14" />
              <Path d="M5 12h14" />
            </Svg>
          }
        />

        {/* 9. Футнот про поддерживаемые файлы. */}
        <Text
          style={{
            textAlign: "center",
            fontFamily: fonts.manrope600,
            fontSize: 9,
            color: tokens.ink3,
          }}
        >
          Поддерживаются файлы: PDF, JPG, PNG (до 10 МБ)
        </Text>
      </ScrollView>
    </AppBackground>
  );
}

/** Зелёный «security»-баннер (макет 1254–1257). */
function SecurityBanner({ tokens }: { tokens: ThemeTokens }) {
  const green = tokens.status.green;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 18,
        backgroundColor: `rgba(${green.rgb},0.10)`,
        borderWidth: 1,
        borderColor: `rgba(${green.rgb},0.30)`,
      }}
    >
      <View style={{ paddingTop: 1 }}>
        <Svg
          width={17}
          height={17}
          viewBox="0 0 24 24"
          fill="none"
          stroke={green.text}
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M20 13c0 5-3.5 7.5-7.7 9a.6.6 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z" />
          <Path d="m9 12 2 2 4-4" />
        </Svg>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: tokens.ink1 }}>
          Мы защищаем ваши данные
        </Text>
        <Text
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 10,
            lineHeight: 15,
            color: tokens.ink2,
          }}
        >
          Документы хранятся в зашифрованном виде и доступны только вам и администрации школы.
        </Text>
      </View>
    </View>
  );
}

/** Section-label uppercase 10.5/800 letterSpacing 0.84 (~.08em). */
function SectionLabel({ text, tokens }: { text: string; tokens: ThemeTokens }) {
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 10.5,
        letterSpacing: 0.84,
        color: tokens.ink3,
      }}
    >
      {text}
    </Text>
  );
}

/** Строка документа: 36×36 gradient-плитка + name + subtitle + шеврон. */
function DocRow({
  doc,
  divider,
  onPress,
  tokens,
  scheme,
}: {
  doc: DocumentRow;
  divider: boolean;
  onPress: () => void;
  tokens: ThemeTokens;
  scheme: "light" | "dark";
}) {
  const divColor = scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(23,18,67,0.07)";
  const chevronColor = scheme === "dark" ? "rgba(255,255,255,0.42)" : "rgba(26,19,74,0.40)";
  // Цветной glow плитки — легкая тень цвета первого стопа градиента.
  const iconRgb = hexToRgb(doc.gradient[0]);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 11,
          paddingVertical: 11,
          borderTopWidth: divider ? 1 : 0,
          borderTopColor: divColor,
        },
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      <LinearGradient
        colors={doc.gradient as [string, string]}
        {...gradPoints(135)}
        style={[
          {
            width: 36,
            height: 36,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
          },
          shadowStyle({ x: 0, y: 6, blur: 12, color: `rgba(${iconRgb},0.30)` }),
        ]}
      >
        <Svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {DOC_ICON_PATHS.map((p, i) => (
            <Path key={i} d={p} />
          ))}
        </Svg>
      </LinearGradient>

      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
          {doc.name}
        </Text>
        <Text
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 9.5,
            color: tokens.ink2,
            marginTop: 2,
          }}
        >
          {doc.subtitle}
        </Text>
      </View>

      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Path
          d="m9 18 6-6-6-6"
          stroke={chevronColor}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

/** Утилита: hex → «r,g,b» для rgba()-теней. Поддерживает #rgb и #rrggbb. */
function hexToRgb(hex: string): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const num = parseInt(h, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r},${g},${b}`;
}
