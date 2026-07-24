/**
 * SubmitWorkSheet — боттом-шит «Отправить работу» (Заход 5, block-list 1–13).
 *
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 2549–2580
 * (только upIsForm / upIsDone; соседние диалоги apWd/naDone/fv из диапазона —
 * это другие компоненты и здесь не собираются).
 *
 * Порядок блоков (block-list Захода 5):
 *   1. SubmitWork.Overlay          — оверлей BottomSheetFrame (клик = onClose)
 *   2. SubmitWork.SheetPanel       — панель BottomSheetFrame (upIsForm | upIsDone)
 *   3. SubmitWork.Form.Grabber     — полоска-грип (showGrip=true, клик = onClose)
 *   4. SubmitWork.Form.Header      — «Отправить работу» + task · subject
 *   5. SubmitWork.Form.Dropzone    — dashed-карточка + чипсы «Выбрать файл» / «Камера»
 *   6. SubmitWork.Form.AttachedFilesList — sc-for по файлам, красная кнопка удаления
 *   7. SubmitWork.Form.CommentTextarea   — Manrope 11.5/600, resize:none
 *   8. SubmitWork.Form.DeadlineWarningBanner — оранжевый alert-баннер
 *   9. SubmitWork.Form.ActionsRow  — «Отмена» (outline) + «Отправить» (accent/disabled)
 *   10. SubmitWork.Done.SuccessCircle — 62×62 зелёный круг с галочкой
 *   11. SubmitWork.Done.Title      — «Работа отправлена» (Unbounded 15/600)
 *   12. SubmitWork.Done.Body       — «Учитель получит уведомление…»
 *   13. SubmitWork.Done.FinishButton — accent-CTA «Готово»
 *
 * Данные (файлы по умолчанию, лимит) — из getHomeworkUploadFixture().
 * Тексты «Отмена»/«Готово» — из useAppLocale().d.parentApp.common; заголовки/
 * дропзона/предупреждение/success — inline из макета (в dictionary этих ключей
 * ещё нет; когда появятся — заменить на t.<key>).
 *
 * Правила заказчика (см. CLAUDE.md + block-list): опозданий НЕТ (баннер про
 * «поздняя работа» — статус late-after-deadline самой задачи, не «опоздание»
 * ученика). Никаких новых нативных модулей — expo-image-picker/file-picker НЕ
 * подключаются в этом заходе: onAddFile/onAddPhoto здесь визуальные заглушки,
 * добавляют fake-файл из фикстуры (Expo Go 54 совместимость).
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";
import { fonts, gradPoints, shadowStyle, useTheme } from "../../../theme";
import { BottomSheetFrame } from "../../../ui";
import { getHomeworkUploadFixture } from "../../../data";
import { useAppLocale } from "../../../i18n";

// ─── Типы ────────────────────────────────────────────────────────────────────

interface FileRow {
  name: string;
  size_label: string;
}

export interface SubmitWorkSheetProps {
  /** Управление показом шита (upOpen из макета). */
  visible: boolean;
  /** Закрытие (upClose): тап по оверлею / грипу / кнопке «Отмена». */
  onClose: () => void;
  /** Название задания (task.title). По умолчанию — из макета (Эссе «My Summer»). */
  taskTitle?: string;
  /** Название предмета (task.subject). По умолчанию — из макета. */
  subjectName?: string;
  /** Показывать оранжевый баннер про «завтра» (task.due_at + is_late_after). */
  showDeadlineWarning?: boolean;
  /** Хук на реальную отправку (в моке — просто переход на done-стейт). */
  onSubmitted?: (payload: { files: FileRow[]; comment: string }) => void;
}

// ─── Иконки (react-native-svg, дословно из макета) ───────────────────────────

/** Иконка файла (плитка 30×30 сине-градиентная, макет строка 2560). */
function FileGlyph() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"
        stroke="#fff"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M14 3v5h5" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Крестик (кнопка удаления файла, макет строка 2560). */
function CrossGlyph({ color = "#b91c1c", size = 10 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6 6 18" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="m6 6 12 12" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

/** Alert-circle (баннер дедлайна, макет строка 2565). */
function AlertGlyph({ color = "#c2410c" }: { color?: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path d="M12 9v4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 17h.01" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Галочка (success-круг, макет строки 2574 / 2592). */
function CheckGlyph() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6 9 17l-5-5"
        stroke="#fff"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Компонент ───────────────────────────────────────────────────────────────

export default function SubmitWorkSheet({
  visible,
  onClose,
  taskTitle = "Эссе «My Summer»",
  subjectName = "Английский язык",
  showDeadlineWarning = true,
  onSubmitted,
}: SubmitWorkSheetProps) {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const t = d.parentApp;
  const dark = scheme === "dark";

  const { files: fixtureFiles, max_files: MAX_FILES } = getHomeworkUploadFixture();

  // Стейт формы (upFileRows, upCommentV) + фазу шита (upIsForm | upIsDone).
  const [files, setFiles] = useState<FileRow[]>(fixtureFiles);
  const [comment, setComment] = useState<string>("");
  const [phase, setPhase] = useState<"form" | "done">("form");

  // При каждом открытии шита возвращаем исходное состояние формы.
  useEffect(() => {
    if (visible) {
      setFiles(fixtureFiles);
      setComment("");
      setPhase("form");
    }
    // fixtureFiles — const из модуля, не меняется, поэтому deps только visible
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // upSendSt: canSend = хотя бы один файл прикреплён.
  const canSend = files.length > 0;

  // Цвета из макета (строки 2554–2577).
  const inkPrimary = dark ? tokens.ink1 : "#171243";
  const inkSecondary = dark ? tokens.ink2 : "rgba(26,19,74,0.6)";
  const inkTertiary = dark ? tokens.ink3 : "rgba(26,19,74,0.55)";
  const inkSecondaryTextarea = dark ? tokens.ink2 : "rgba(26,19,74,0.7)";

  const violetText = "#6D28D9";
  const violetBorder = "rgba(124,58,237,0.45)";
  const violetBorderDashed = "rgba(124,58,237,0.4)";
  const cardBg = dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)";
  const cardBorder = dark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.8)";
  const outlineBtnBg = dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.4)";
  const dropzoneBg = dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.35)";

  const orangeText = "#C2410C";
  const orangeBg = "rgba(249,115,22,0.12)";
  const orangeBorder = "rgba(249,115,22,0.35)";

  const redIconBg = "rgba(239,68,68,0.12)";
  const redIconBorder = "rgba(239,68,68,0.3)";
  const redIconStroke = dark ? tokens.status.red.text : "#b91c1c";

  // ─── Handlers ──────────────────────────────────────────────────────────────

  /** upAddF — «Выбрать файл»: в моке добавляем следующий из фикстуры. */
  const handleAddFile = () => {
    if (files.length >= MAX_FILES) return;
    // Пропускаем уже добавленные, берём следующий по порядку из фикстуры.
    const next =
      fixtureFiles.find((f) => !files.some((x) => x.name === f.name)) ??
      fixtureFiles[files.length % fixtureFiles.length];
    setFiles([...files, next]);
  };
  /** upAddP — «Камера»: тот же mock-путь (Expo Go 54: без ImagePicker модуля). */
  const handleAddPhoto = () => handleAddFile();

  /** f.del — удалить файл по индексу. */
  const handleRemove = (idx: number) => {
    setFiles(files.filter((_, i) => i !== idx));
  };

  /** upSend — отправить работу: переходим на done-стейт. */
  const handleSend = () => {
    if (!canSend) return;
    onSubmitted?.({ files, comment });
    setPhase("done");
  };

  /** upFinish — закрыть шит из done-стейта. */
  const handleFinish = () => onClose();

  // ─── Рендер ────────────────────────────────────────────────────────────────

  return (
    <BottomSheetFrame visible={visible} onClose={onClose} showGrip={phase === "form"}>
      {/* Панель шита (упаковка контента + внутренние паддинги). */}
      <View style={styles.panelInner}>
        {phase === "form" ? (
          <View style={{ flexDirection: "column", gap: 10 }}>
            {/* 4. Header: «Отправить работу» + task · subject */}
            <View style={{ flexDirection: "column", gap: 2 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: fonts.manrope800,
                  color: inkPrimary,
                }}
              >
                Отправить работу
              </Text>
              <Text
                style={{
                  fontSize: 10.5,
                  fontFamily: fonts.manrope700,
                  color: inkSecondary,
                }}
              >
                {taskTitle} · {subjectName}
              </Text>
            </View>

            {/* 5. Dropzone: пунктирная карточка + два чипса */}
            <View
              style={{
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                paddingVertical: 16,
                paddingHorizontal: 14,
                borderRadius: 18,
                borderWidth: 2,
                borderStyle: "dashed",
                borderColor: violetBorderDashed,
                backgroundColor: dropzoneBg,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: fonts.manrope700,
                  color: inkSecondaryTextarea,
                }}
              >
                Прикрепите файл или сделайте фото
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <AccentChip label="Выбрать файл" onPress={handleAddFile} />
                <OutlineChip
                  label="Камера"
                  onPress={handleAddPhoto}
                  bg={outlineBtnBg}
                  borderColor={violetBorder}
                  color={violetText}
                />
              </View>
            </View>

            {/* 6. AttachedFilesList: sc-for по upFileRows */}
            {files.map((f, idx) => (
              <View
                key={`${f.name}-${idx}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingVertical: 9,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  backgroundColor: cardBg,
                  borderWidth: 1,
                  borderColor: cardBorder,
                }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <LinearGradient
                    colors={["#60a5fa", "#2563eb"]}
                    {...gradPoints(135)}
                    style={StyleSheet.absoluteFill}
                  />
                  <FileGlyph />
                </View>
                <View style={{ flex: 1, minWidth: 0, flexDirection: "column" }}>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      fontSize: 10.5,
                      fontFamily: fonts.manrope800,
                      color: inkPrimary,
                    }}
                  >
                    {f.name}
                  </Text>
                  <Text
                    style={{
                      fontSize: 9,
                      fontFamily: fonts.manrope700,
                      color: inkTertiary,
                    }}
                  >
                    {f.size_label}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleRemove(idx)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: redIconBg,
                    borderWidth: 1,
                    borderColor: redIconBorder,
                  }}
                  hitSlop={6}
                >
                  <CrossGlyph color={redIconStroke} size={10} />
                </Pressable>
              </View>
            ))}

            {/* 7. CommentTextarea */}
            <View
              style={{
                flexDirection: "column",
                gap: 4,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 14,
                backgroundColor: cardBg,
                borderWidth: 1,
                borderColor: cardBorder,
              }}
            >
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Комментарий для учителя (необязательно)"
                placeholderTextColor={inkTertiary}
                multiline
                numberOfLines={2}
                style={{
                  fontFamily: fonts.manrope600,
                  fontSize: 11.5,
                  color: inkPrimary,
                  minHeight: 40,
                  padding: 0,
                  textAlignVertical: "top",
                }}
              />
            </View>

            {/* 8. DeadlineWarningBanner (условный) */}
            {showDeadlineWarning ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 9,
                  paddingHorizontal: 12,
                  borderRadius: 13,
                  backgroundColor: orangeBg,
                  borderWidth: 1,
                  borderColor: orangeBorder,
                }}
              >
                <AlertGlyph color={orangeText} />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 10,
                    fontFamily: fonts.manrope700,
                    color: orangeText,
                  }}
                >
                  Срок сдачи — завтра. Работа, отправленная позже, будет отмечена как поздняя.
                </Text>
              </View>
            ) : null}

            {/* 9. ActionsRow: «Отмена» + «Отправить» */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={onClose}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: outlineBtnBg,
                  borderWidth: 1.5,
                  borderColor: violetBorder,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: fonts.manrope800,
                    color: violetText,
                  }}
                >
                  {t.common.cancel}
                </Text>
              </Pressable>

              <AccentSubmitButton
                label="Отправить"
                onPress={handleSend}
                disabled={!canSend}
              />
            </View>
          </View>
        ) : (
          // ─── upIsDone (блоки 10–13) ─────────────────────────────────────────
          <View
            style={{
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              paddingTop: 14,
              paddingHorizontal: 4,
              paddingBottom: 4,
            }}
          >
            {/* 10. SuccessCircle */}
            <View
              style={[
                {
                  width: 62,
                  height: 62,
                  borderRadius: 31,
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                },
                shadowStyle({ x: 0, y: 16, blur: 36, color: "rgba(5,150,105,0.4)" }),
              ]}
            >
              <LinearGradient
                colors={["#34d399", "#059669"]}
                {...gradPoints(135)}
                style={StyleSheet.absoluteFill}
              />
              <CheckGlyph />
            </View>

            {/* 11. Title */}
            <Text
              style={{
                fontFamily: fonts.unbounded600,
                fontSize: 15,
                color: inkPrimary,
              }}
            >
              Работа отправлена
            </Text>

            {/* 12. Body */}
            <Text
              style={{
                fontSize: 11,
                fontFamily: fonts.manrope600,
                lineHeight: 11 * 1.6,
                color: inkSecondary,
                textAlign: "center",
              }}
            >
              Учитель получит уведомление. Статус задания изменён на «На проверке».
            </Text>

            {/* 13. FinishButton */}
            <FinishAccentButton label={t.common.done} onPress={handleFinish} />
          </View>
        )}
      </View>
    </BottomSheetFrame>
  );
}

// ─── Внутренние вспомогательные компоненты ───────────────────────────────────

/** Accent-чипс «Выбрать файл» (фиолетовый градиент). */
function AccentChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          borderRadius: 11,
          overflow: "hidden",
        },
        shadowStyle({ x: 0, y: 8, blur: 18, color: "rgba(124,58,237,0.35)" }),
      ]}
    >
      <LinearGradient
        colors={["#7c3aed", "#4f6df5"]}
        {...gradPoints(135)}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 13,
        }}
      >
        <Text
          style={{
            fontSize: 10.5,
            fontFamily: fonts.manrope800,
            color: "#fff",
          }}
        >
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

/** Outline-чипс «Камера». */
function OutlineChip({
  label,
  onPress,
  bg,
  borderColor,
  color,
}: {
  label: string;
  onPress: () => void;
  bg: string;
  borderColor: string;
  color: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 13,
        borderRadius: 11,
        backgroundColor: bg,
        borderWidth: 1.5,
        borderColor,
      }}
    >
      <Text
        style={{
          fontSize: 10.5,
          fontFamily: fonts.manrope800,
          color,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** «Отправить» — accent, enabled/disabled. Стиль макета: upSendSt переключает
 *  opacity/фон в зависимости от валидности; в disabled — приглушённый accent. */
function AccentSubmitButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const content: ReactNode = (
    <Text
      style={{
        fontSize: 12,
        fontFamily: fonts.manrope800,
        color: "#fff",
      }}
    >
      {label}
    </Text>
  );
  if (disabled) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 12,
          borderRadius: 14,
          backgroundColor: "rgba(124,58,237,0.4)",
        }}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          flex: 1,
          borderRadius: 14,
          overflow: "hidden",
        },
        shadowStyle({ x: 0, y: 12, blur: 28, color: "rgba(124,58,237,0.4)" }),
      ]}
    >
      <LinearGradient
        colors={["#7c3aed", "#4f6df5"]}
        {...gradPoints(135)}
        style={{
          paddingVertical: 12,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {content}
      </LinearGradient>
    </Pressable>
  );
}

/** «Готово» — крупная accent-кнопка на всю ширину панели (done-стейт). */
function FinishAccentButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          alignSelf: "stretch",
          borderRadius: 14,
          overflow: "hidden",
        },
        shadowStyle({ x: 0, y: 12, blur: 28, color: "rgba(124,58,237,0.4)" }),
      ]}
    >
      <LinearGradient
        colors={["#7c3aed", "#4f6df5"]}
        {...gradPoints(135)}
        style={{
          paddingVertical: 13,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: 12.5,
            fontFamily: fonts.manrope800,
            color: "#fff",
          }}
        >
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Внутренний контейнер панели: горизонтальные поля 16, нижний отступ учитывает
  // safe-area (шит уже поднят BottomSheetFrame на bottom:8, дополнительный
  // padding — визуальная воздушность, как в макете paddingBottom 16–20).
  panelInner: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 20,
  },
});
