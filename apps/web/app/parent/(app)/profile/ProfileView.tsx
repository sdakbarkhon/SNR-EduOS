"use client";

/**
 * Экран dhub «Профиль-хаб» — ВЕБ-перенос 1:1 из
 * apps/mobile-parent/src/screens/tabs/ProfileHubScreen.tsx
 * (ветка feat/mobile-parent-redesign → макет «SNR EduOS v2 Light.dc.html»,
 * строки 1132–1164).
 *
 * Композиция сверху вниз — дословно как в RN:
 *  1. Шапка (без bell/аватара): заголовок «Профиль» Unbounded 15 + flex +
 *     одна glass-кнопка 38 (sliders → d34 «Язык и безопасность»).
 *  2. Карточка родителя (GlassCard r22): аватар 54 с двойным кольцом (белый 2
 *     + фиолетовый 2.5) + инициалы + ФИО + role_label «Родитель» + телефон + шеврон.
 *  3. SectionHeader «Мои дети».
 *  4. GlassCard-list детей: аватар 36 с ring, ФИО + класс, StatusChip
 *     (green «В школе» / gray «Дома»), шеврон.
 *  5. SectionHeader «Настройки».
 *  6. GlassCard-list из 4 строк — Documents/Notifications/PayMethods/LangSec.
 *  7. SectionHeader «Поддержка».
 *  8. GlassCard-list из 2 строк — Help/About.
 *  9. Кнопка «Выйти» — border-red 1.5, red text (открывает confirm-модалку
 *     CONFIRM_DIALOGS.logout).
 * 10. Подпись «SNR EduOS · версия {v}».
 *
 * Данные — только через аксессоры v2/data (getParent / getChildren /
 * getConfirmDialog), т.е. ветка `isRealFlow === false` RN-экрана: в вебе нет
 * ни AuthSessionContext, ни ParentDataContext, а БД по условию задачи не
 * подключается. Поэтому показываются фикстурные ФИО/телефон/дети со
 * статус-чипами (в реальной ветке RN чипы скрыты, а активный ребёнок
 * помечается галочкой — этого состояния на фикстурах не существует).
 *
 * Иконки: в RN это литеральные `d`-пути react-native-svg; здесь те же самые
 * пути инлайновым <svg> — это гарантированно 1:1 (lucide-react отрисовал бы
 * слегка другую геометрию тех же по смыслу глифов, см. отчёт).
 */

import { useEffect, useState, type ReactNode } from "react";
import { LogoutOverlay, useLogout } from "@/components/LogoutOverlay";
import { GlassCard } from "../v2/GlassCard";
import { getChildren, getConfirmDialog, getParent } from "../v2/data";
import {
  accentGrad,
  chip,
  fontDisplay,
  glass1,
  glassBorder,
  ink1,
  ink2,
  ink3,
  radius,
  status,
} from "../v2/tokens";

/* ── Константы макета ───────────────────────────────────────────────────── */

/** Разделитель строк внутри карточки-списка (светлая тема RN). */
const DIVIDER = "rgba(23,18,67,0.07)";
/** Цвет заголовка секции — SectionHeader.tsx, rgba(26,19,74,.5) (строка 2772). */
const SECTION_TITLE = "rgba(26,19,74,0.5)";
/** Шеврон строки — ChevronRight() RN-экрана (светлая тема). */
const CHEVRON = "rgba(26,19,74,0.4)";
/** Стекло confirm-панели — BottomSheetFrame, строка 4228 макета. */
const SHEET_BG = "linear-gradient(160deg, rgba(255,255,255,0.92), rgba(255,255,255,0.76))";
const SHEET_BORDER = "rgba(255,255,255,0.9)";
const SHEET_SHADOW = "0 -16px 50px rgba(64,54,150,0.3), inset 0 1.5px 0 rgba(255,255,255,0.95)";
/** Оверлей confirm-модалки — confOv, строка 4026 (.38 против .35 у шторок). */
const CONF_OVERLAY = "rgba(23,18,67,0.38)";
/** Вторичный текст confirm — CenterModalFrame, строка 2486. */
const CONF_TEXT = "rgba(26,19,74,0.66)";
/** Версия приложения: Constants.expoConfig.version мобилки = app.json «1.0.0». */
const APP_VERSION = "1.0.0";

/** Экранов d28–d34/da7 в вебе пока нет — переходы не подключены (см. отчёт). */
const noop = () => {};

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

/* ── Мелкие примитивы (перенос ui/* мобилки) ────────────────────────────── */

/**
 * Avatar variant="ring" — инициалы на градиенте 135°, двойное кольцо
 * «0 0 0 2px #fff + 0 0 0 4.5px ring» (макет, хелпер av(), строка 3832).
 * В RN кольца рисовались вложенными View (box-shadow там нет) и потому
 * требовали внешний margin 4.5 — здесь исходная форма макета (box-shadow),
 * margin оставлен, чтобы раскладка строки совпадала с мобильной.
 */
function Avatar({
  size,
  initials,
  gradient,
  ringColor,
  fontSize,
}: {
  size: number;
  initials: string;
  gradient: readonly [string, string];
  ringColor: string;
  fontSize: number;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        margin: 4.5,
        background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
        boxShadow: `0 0 0 2px #FFFFFF, 0 0 0 4.5px ${ringColor}`,
        color: "#FFFFFF",
        fontSize,
        fontWeight: 800,
        lineHeight: 1,
      }}
    >
      {initials}
    </span>
  );
}

/** SectionHeader — caps 10.5/800, letter-spacing .08em (≈0.84), rgba(26,19,74,.5). */
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between">
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: 0.84,
          textTransform: "uppercase",
          color: SECTION_TITLE,
        }}
      >
        {title}
      </span>
    </div>
  );
}

/**
 * StatusChip — r999, 5×10, текст 10.5/800; фон/бордер из tokens.chip(rgb),
 * variant 'live' — точка-индикатор 6px (макет строка 2708).
 */
function StatusChip({ label, family }: { label: string; family: "green" | "gray" }) {
  const st = status[family];
  const c = chip(st.rgb);
  return (
    <span
      className="inline-flex shrink-0 items-center"
      style={{
        gap: 5,
        padding: "5px 10px",
        borderRadius: radius.chip,
        background: c.background,
        border: `1px solid ${c.borderColor}`,
      }}
    >
      {family === "green" ? (
        <span
          style={{ width: 6, height: 6, borderRadius: 3, background: `rgb(${st.rgb})` }}
        />
      ) : null}
      <span style={{ fontSize: 10.5, fontWeight: 800, color: st.text, lineHeight: 1.2 }}>
        {label}
      </span>
    </span>
  );
}

/** ChevronRight — 14px, stroke 2.2 (ChevronRight() RN-экрана). */
function ChevronRight() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke={CHEVRON}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** Глиф выхода — тот же путь, что в RN (кнопка «Выйти» и иконка модалки). */
function LogoutGlyph({ size, strokeWidth = 2 }: { size: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={status.red.text}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

/** Круглая стеклянная кнопка 38 (RootHeader.GlassCircleButton: glass1 + blur 18). */
function GlassCircleButton({
  onClick,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full"
      style={{
        background: glass1.background,
        border: `1px solid ${glassBorder}`,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
    >
      {children}
    </button>
  );
}

/* ── Пункты меню (Настройки / Поддержка) ────────────────────────────────── */

interface HubMenuItem {
  key: string;
  title: string;
  subtitle: string;
  gradient: [string, string];
  iconPaths: string[];
}

const SETTINGS_ITEMS: HubMenuItem[] = [
  {
    key: "docs",
    title: "Документы",
    subtitle: "Свидетельства, справки, ID",
    gradient: ["#60a5fa", "#2563eb"],
    iconPaths: [
      "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z",
      "M14 3v5h5",
      "M9 13h6",
      "M9 17h4",
    ],
  },
  {
    key: "notifSet",
    title: "Настройки уведомлений",
    subtitle: "Оценки, задания, оплаты",
    gradient: ["#fbbf24", "#f97316"],
    iconPaths: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  },
  {
    key: "payMeth",
    title: "Способы оплаты",
    subtitle: "Карты и платёжные системы",
    gradient: ["#a78bfa", "#7c3aed"],
    iconPaths: [
      "M2 8a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z",
      "M2 10h20",
    ],
  },
  {
    key: "langSec",
    title: "Язык и безопасность",
    subtitle: "Язык, пароль, биометрия",
    gradient: ["#22d3ee", "#0891b2"],
    iconPaths: [
      "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
      "M3 12h18",
      "M12 3a13 13 0 0 1 0 18",
      "M12 3a13 13 0 0 0 0 18",
    ],
  },
];

const SUPPORT_ITEMS: HubMenuItem[] = [
  {
    key: "support",
    title: "Помощь и поддержка",
    subtitle: "Чат с поддержкой школы",
    gradient: ["#f472b6", "#db2777"],
    iconPaths: [
      "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
      "M9 10a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.7",
      "M12 17h.01",
    ],
  },
  {
    key: "about",
    title: "О приложении",
    subtitle: "SNR EduOS для родителей",
    gradient: ["#94a3b8", "#64748b"],
    iconPaths: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 8h.01", "M11 12h1v4h1"],
  },
];

/** Строка ребёнка «Мои дети» — RN ChildHubRow (py 10, gap 11, аватар 36). */
function ChildHubRow({
  fullName,
  classLabel,
  initials,
  gradient,
  ringColor,
  statusChip,
  tone,
  divider,
  onClick,
}: {
  fullName: string;
  classLabel: string;
  initials: string;
  gradient: readonly [string, string];
  ringColor: string;
  statusChip: string;
  tone: "green" | "gray";
  divider: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center text-left"
      style={{
        gap: 11,
        paddingTop: 10,
        paddingBottom: 10,
        borderTop: divider ? `1px solid ${DIVIDER}` : undefined,
      }}
    >
      <Avatar size={36} initials={initials} gradient={gradient} ringColor={ringColor} fontSize={12} />
      <span className="min-w-0 flex-1">
        <span className="block" style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>
          {fullName}
        </span>
        <span className="block" style={{ fontSize: 10, fontWeight: 700, color: ink2, marginTop: 2 }}>
          {classLabel}
        </span>
      </span>
      {statusChip ? <StatusChip label={statusChip} family={tone} /> : null}
      <ChevronRight />
    </button>
  );
}

/** Строка пункта меню — RN HubMenuRow (py 11, gap 11, плитка 36 r12). */
function HubMenuRow({
  item,
  divider,
  onClick,
}: {
  item: HubMenuItem;
  divider: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center text-left"
      style={{
        gap: 11,
        paddingTop: 11,
        paddingBottom: 11,
        borderTop: divider ? `1px solid ${DIVIDER}` : undefined,
      }}
    >
      <span
        className="flex shrink-0 items-center justify-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${item.gradient[0]}, ${item.gradient[1]})`,
        }}
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {item.iconPaths.map((p, i) => (
            <path key={i} d={p} />
          ))}
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block" style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>
          {item.title}
        </span>
        <span className="block" style={{ fontSize: 10.5, fontWeight: 600, color: ink2, marginTop: 2 }}>
          {item.subtitle}
        </span>
      </span>
      <ChevronRight />
    </button>
  );
}

/* ── Экран ──────────────────────────────────────────────────────────────── */

export function ProfileView() {
  const [logoutOpen, setLogoutOpen] = useState(false);
  // Анимация confirm-панели: translateY(115%) → 0, .32s cubic-bezier(.2,.7,.3,1)
  // (макет строка 4228); оверлей — opacity .28s (строка 4027).
  const [modalMounted, setModalMounted] = useState(false);
  const [modalEntered, setModalEntered] = useState(false);
  const { loggingOut, logout } = useLogout();

  useEffect(() => {
    if (logoutOpen) {
      setModalMounted(true);
      const raf = window.requestAnimationFrame(() => setModalEntered(true));
      return () => window.cancelAnimationFrame(raf);
    }
    setModalEntered(false);
    const t = window.setTimeout(() => setModalMounted(false), 280);
    return () => window.clearTimeout(t);
  }, [logoutOpen]);

  const parent = getParent();
  const children = getChildren();
  const logoutDialog = getConfirmDialog("logout");

  return (
    <div className="mx-auto flex h-full w-full max-w-[430px] flex-col">
      {/* 1. Шапка dhub: row gap 10, padding 46/18/8. */}
      <div className="flex items-center" style={{ gap: 10, paddingTop: 46, paddingLeft: 18, paddingRight: 18, paddingBottom: 8 }}>
        <h1 style={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: 15, color: ink1 }}>
          Профиль
        </h1>
        <span className="flex-1" />
        <GlassCircleButton onClick={noop} ariaLabel="Язык и безопасность">
          <svg
            width={17}
            height={17}
            viewBox="0 0 24 24"
            fill="none"
            stroke={ink1}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M6 12h12" />
            <path d="M9 18h6" />
          </svg>
        </GlassCircleButton>
      </div>

      {/* TabScreenScroll: paddingHorizontal 18, gap 12, paddingBottom 8. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className="flex flex-col"
          style={{ gap: 12, paddingLeft: 18, paddingRight: 18, paddingBottom: 8 }}
        >
          {/* 2. Карточка родителя (r22, padding 14). */}
          <GlassCard radius={22} className="p-[14px]" onClick={noop}>
            <div className="flex items-center" style={{ gap: 12 }}>
              <Avatar
                size={54}
                initials={parent.initials}
                gradient={parent.avatar_gradient}
                ringColor="#8b5cf6"
                fontSize={16}
              />
              <div className="min-w-0 flex-1">
                <div style={{ fontSize: 14.5, fontWeight: 800, color: ink1 }}>
                  {parent.full_name}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: status.violet.text, marginTop: 2 }}>
                  Родитель
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: ink2, marginTop: 2 }}>
                  {parent.phone}
                </div>
              </div>
              <ChevronRight />
            </div>
          </GlassCard>

          {/* 3–4. «Мои дети». */}
          <SectionHeader title="Мои дети" />
          <GlassCard className="px-[14px] py-1">
            {children.map((k, i) => (
              <ChildHubRow
                key={k.id}
                fullName={k.full_name}
                classLabel={`${k.class_name} класс`}
                initials={k.first_name.slice(0, 1)}
                gradient={k.avatar_gradient}
                ringColor={k.avatar_ring}
                statusChip={k.status_chip}
                tone={k.status_chip === "В школе" ? "green" : "gray"}
                divider={i > 0}
                onClick={noop}
              />
            ))}
          </GlassCard>

          {/* 5–6. Настройки. */}
          <SectionHeader title="Настройки" />
          <GlassCard className="px-[14px] py-1">
            {SETTINGS_ITEMS.map((it, i) => (
              <HubMenuRow key={it.key} item={it} divider={i > 0} onClick={noop} />
            ))}
          </GlassCard>

          {/* 7–8. Поддержка. */}
          <SectionHeader title="Поддержка" />
          <GlassCard className="px-[14px] py-1">
            {SUPPORT_ITEMS.map((it, i) => (
              <HubMenuRow key={it.key} item={it} divider={i > 0} onClick={noop} />
            ))}
          </GlassCard>

          {/* 9. Выйти. */}
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className="flex items-center justify-center"
            style={{
              gap: 8,
              paddingTop: 14,
              paddingBottom: 14,
              borderRadius: 16,
              border: `1.5px solid rgba(${status.red.rgb},0.55)`,
            }}
          >
            <LogoutGlyph size={16} />
            <span style={{ fontSize: 12.5, fontWeight: 800, color: status.red.text }}>Выйти</span>
          </button>

          {/* 10. Подпись версии. */}
          <div
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: ink3,
              textAlign: "center",
              marginTop: 4,
            }}
          >
            {fillTemplate("SNR EduOS · версия {v}", { v: APP_VERSION })}
          </div>
        </div>
      </div>

      {/* Подтверждение выхода — CenterModalFrame (BottomSheetFrame, showGrip=false). */}
      {modalMounted ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Закрыть"
            onClick={() => setLogoutOpen(false)}
            className="absolute inset-0 w-full transition-opacity"
            style={{
              background: CONF_OVERLAY,
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              opacity: modalEntered ? 1 : 0,
              transitionDuration: "280ms",
            }}
          />
          <div className="pointer-events-none absolute inset-0 mx-auto flex max-w-[430px] items-end">
            <div
              className="pointer-events-auto w-full overflow-hidden"
              style={{
                margin: 8,
                borderRadius: 30,
                background: SHEET_BG,
                backdropFilter: "blur(26px)",
                WebkitBackdropFilter: "blur(26px)",
                border: `1px solid ${SHEET_BORDER}`,
                boxShadow: SHEET_SHADOW,
                transform: modalEntered ? "translateY(0)" : "translateY(115%)",
                transition: "transform 320ms cubic-bezier(0.2,0.7,0.3,1)",
              }}
            >
              <div
                className="flex flex-col items-center"
                style={{ gap: 10, paddingTop: 24, paddingLeft: 22, paddingRight: 22, paddingBottom: 18 }}
              >
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    background: `rgba(${status.red.rgb},0.12)`,
                    border: `1px solid rgba(${status.red.rgb},0.35)`,
                  }}
                >
                  <LogoutGlyph size={24} />
                </div>
                <div
                  style={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: 15, color: ink1, textAlign: "center" }}
                >
                  {logoutDialog?.title ?? "Выйти?"}
                </div>
                {logoutDialog?.body ? (
                  <div
                    style={{ fontSize: 11, fontWeight: 600, lineHeight: "17px", color: CONF_TEXT, textAlign: "center" }}
                  >
                    {logoutDialog.body}
                  </div>
                ) : null}

                <div className="flex w-full" style={{ gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => setLogoutOpen(false)}
                    className="flex-1"
                    style={{
                      paddingTop: 14,
                      paddingBottom: 14,
                      borderRadius: 16,
                      background: "rgba(23,18,67,0.06)",
                      fontSize: 12.5,
                      fontWeight: 800,
                      color: ink1,
                    }}
                  >
                    Отмена
                  </button>
                  {/* PrimaryButton: accent-градиент 135°, r16, padding 15,
                      текст 14/800 #fff, тень 0 14 32 rgba(124,58,237,.4),
                      inset-блик W35 → верхняя hairline 1.5. */}
                  <button
                    type="button"
                    onClick={() => {
                      setLogoutOpen(false);
                      void logout();
                    }}
                    className="relative flex-1 overflow-hidden"
                    style={{
                      padding: 15,
                      borderRadius: 16,
                      background: accentGrad,
                      boxShadow: "0 14px 32px rgba(124,58,237,0.4)",
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#FFFFFF",
                    }}
                  >
                    {logoutDialog?.action_label ?? "Выйти"}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0"
                      style={{ height: 1.5, background: "rgba(255,255,255,0.35)" }}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {loggingOut ? <LogoutOverlay /> : null}
    </div>
  );
}
