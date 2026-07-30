"use client";

/**
 * Экран dhub «Профиль» — веб-порт
 * apps/mobile-parent/src/screens/tabs/ProfileHubScreen.tsx (макет
 * «SNR EduOS v2 Light.dc.html», строки 1132–1164), на реальных данных.
 *
 * Против первой веб-версии (Блок 7.1) изменилось три вещи:
 *
 *  1. ФИО родителя и ребёнка приходят из `getParentContext()`, а не из
 *     фикстуры v2/data — раньше экран показывал чужую семью (Каримовых).
 *  2. Раздела-списка «Мои дети» нет. У этой семьи ребёнок ровно один, и
 *     список из одного элемента с шевроном «выбрать» — интерфейс ни о чём:
 *     ребёнок показан отдельной карточкой как основной аккаунт, клик по ней
 *     ведёт сразу в его профиль.
 *  3. Все пункты меню ведут на настоящие экраны, а не в `noop`.
 *
 * Телефона родителя в карточке нет: колонки с ним в `parents` (в том, что
 * отдаёт getParentContext) нет, а фикстурный номер был выдуман.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogoutOverlay, useLogout } from "@/components/LogoutOverlay";
import { GlassCard } from "../v2/GlassCard";
import { ModalPortal, Z_MODAL, Z_MODAL_PANEL } from "../v2/ModalPortal";
import {
  Avatar,
  CardRow,
  ChevronRight,
  Glyph,
  GlassCircleButton,
  ICON,
  IconTile,
  RowText,
  SectionCap,
  WHITE,
} from "../_ui/screen-kit";
import { accentGrad, fontDisplay, ink1, ink2, ink3, status } from "../v2/tokens";

/** Версия приложения — совпадает с app.json мобилки. */
const APP_VERSION = "1.0.0";

/** Стекло confirm-панели — BottomSheetFrame макета (строка 4228). */
const SHEET_BG = "linear-gradient(160deg, rgba(255,255,255,0.92), rgba(255,255,255,0.76))";
const SHEET_BORDER = "rgba(255,255,255,0.9)";
const SHEET_SHADOW = "0 -16px 50px rgba(64,54,150,0.3), inset 0 1.5px 0 rgba(255,255,255,0.95)";
const CONF_OVERLAY = "rgba(23,18,67,0.38)";
const CONF_TEXT = "rgba(26,19,74,0.66)";

interface HubMenuItem {
  key: string;
  title: string;
  subtitle: string;
  href: string;
  gradient: [string, string];
  paths: readonly string[];
}

const SETTINGS_ITEMS: HubMenuItem[] = [
  {
    key: "docs",
    title: "Документы",
    subtitle: "Свидетельства, справки, ID",
    href: "/parent/documents",
    gradient: ["#60a5fa", "#2563eb"],
    paths: ICON.doc,
  },
  {
    key: "notifSet",
    title: "Настройки уведомлений",
    subtitle: "Оценки, задания, оплаты",
    href: "/parent/notif-settings",
    gradient: ["#fbbf24", "#f97316"],
    paths: ICON.bell,
  },
  {
    key: "payMeth",
    title: "Способы оплаты",
    subtitle: "Карты и платёжные системы",
    href: "/parent/payments/methods",
    gradient: ["#a78bfa", "#7c3aed"],
    paths: ICON.card,
  },
  {
    key: "langSec",
    title: "Язык и безопасность",
    subtitle: "Язык, пароль, вход",
    href: "/parent/lang-security",
    gradient: ["#22d3ee", "#0891b2"],
    paths: ICON.globe,
  },
];

const SUPPORT_ITEMS: HubMenuItem[] = [
  {
    key: "support",
    title: "Помощь и поддержка",
    subtitle: "Чат с поддержкой школы",
    href: "/parent/chat/support",
    gradient: ["#f472b6", "#db2777"],
    paths: ICON.help,
  },
  {
    key: "about",
    title: "О приложении",
    subtitle: "SNR EduOS для родителей",
    href: "/parent/about",
    gradient: ["#94a3b8", "#64748b"],
    paths: ICON.info,
  },
];

export function ProfileView({
  parentName,
  parentInitials,
  parentGradient,
  child,
}: {
  parentName: string;
  parentInitials: string;
  parentGradient: readonly [string, string];
  child: {
    fullName: string;
    classLabel: string;
    initials: string;
    gradient: readonly [string, string];
    ring: string;
  } | null;
}) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  // Анимация confirm-панели: translateY(115%) → 0, .32s (макет строка 4228);
  // оверлей — opacity .28s (строка 4027).
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

  return (
    <div className="mx-auto flex h-full w-full max-w-[430px] flex-col">
      {/* 1. Шапка dhub: заголовок + кнопка «Язык и безопасность». */}
      <div
        className="flex items-center"
        style={{ gap: 10, paddingTop: 46, paddingLeft: 18, paddingRight: 18, paddingBottom: 8 }}
      >
        <h1 style={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: 15, color: ink1 }}>Профиль</h1>
        <span className="flex-1" />
        <GlassCircleButton href="/parent/lang-security" ariaLabel="Язык и безопасность">
          <Glyph
            paths={["M3 6h18", "M6 12h12", "M9 18h6"]}
            size={17}
            color={ink1}
            strokeWidth={1.8}
          />
        </GlassCircleButton>
      </div>

      <div className="min-h-0 flex-1">
        <div className="flex flex-col" style={{ gap: 12, paddingLeft: 18, paddingRight: 18, paddingBottom: 8 }}>
          {/* 2. Карточка родителя. */}
          <GlassCard radius={22} className="p-[14px]">
            <div className="flex items-center" style={{ gap: 12 }}>
              <Avatar
                size={54}
                initials={parentInitials}
                gradient={parentGradient}
                ringColor="#8b5cf6"
                fontSize={16}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate" style={{ fontSize: 14.5, fontWeight: 800, color: ink1 }}>
                  {parentName}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: status.violet.text, marginTop: 2 }}>
                  Родитель
                </div>
              </div>
            </div>
          </GlassCard>

          {/* 3. Ребёнок — один, поэтому отдельной карточкой, а не списком. */}
          {child ? (
            <>
              <SectionCap label="Ребёнок" />
              <GlassCard className="px-[14px] py-1">
                <CardRow href="/parent/child" divider={false} paddingY={10}>
                  <Avatar
                    size={36}
                    initials={child.initials}
                    gradient={child.gradient}
                    ringColor={child.ring}
                    fontSize={12}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate" style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>
                      {child.fullName}
                    </span>
                    <span
                      className="block"
                      style={{ fontSize: 10, fontWeight: 700, color: ink2, marginTop: 2 }}
                    >
                      {child.classLabel}
                    </span>
                  </span>
                  <ChevronRight />
                </CardRow>
              </GlassCard>
            </>
          ) : null}

          {/* 4. Настройки. */}
          <SectionCap label="Настройки" />
          <GlassCard className="px-[14px] py-1">
            {SETTINGS_ITEMS.map((it, i) => (
              <CardRow key={it.key} href={it.href} divider={i > 0}>
                <IconTile gradient={it.gradient} paths={it.paths} size={36} glyphSize={18} />
                <RowText title={it.title} subtitle={it.subtitle} />
                <ChevronRight />
              </CardRow>
            ))}
          </GlassCard>

          {/* 5. Поддержка. */}
          <SectionCap label="Поддержка" />
          <GlassCard className="px-[14px] py-1">
            {SUPPORT_ITEMS.map((it, i) => (
              <CardRow key={it.key} href={it.href} divider={i > 0}>
                <IconTile gradient={it.gradient} paths={it.paths} size={36} glyphSize={18} />
                <RowText title={it.title} subtitle={it.subtitle} />
                <ChevronRight />
              </CardRow>
            ))}
          </GlassCard>

          {/* 6. Выйти. */}
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
            <Glyph paths={ICON.logout} size={16} color={status.red.text} strokeWidth={2} />
            <span style={{ fontSize: 12.5, fontWeight: 800, color: status.red.text }}>Выйти</span>
          </button>

          {/* 7. Подпись версии. */}
          <Link
            href="/parent/about"
            style={{ fontSize: 9, fontWeight: 600, color: ink3, textAlign: "center", marginTop: 4 }}
          >
            {`SNR EduOS · версия ${APP_VERSION}`}
          </Link>
        </div>
      </div>

      {/* Подтверждение выхода. Через ModalPortal (портал в document.body +
          слой выше таб-бара): раньше стояло `fixed inset-0 z-50`, как и у
          FloatingTabBar, и при равном z-index побеждал таб-бар — он
          рендерится в каркасе позже. Кнопку «Выйти» перекрывала навигация. */}
      {modalMounted ? (
        <ModalPortal>
        <div className="fixed inset-0" style={{ zIndex: Z_MODAL }}>
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
          <div
            className="pointer-events-none absolute inset-0 mx-auto flex max-w-[430px] items-end"
            style={{ zIndex: Z_MODAL_PANEL }}
          >
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
                  <Glyph paths={ICON.logout} size={24} color={status.red.text} strokeWidth={2} />
                </div>
                <div
                  style={{
                    fontFamily: fontDisplay,
                    fontWeight: 600,
                    fontSize: 15,
                    color: ink1,
                    textAlign: "center",
                  }}
                >
                  Выйти из аккаунта?
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    lineHeight: "17px",
                    color: CONF_TEXT,
                    textAlign: "center",
                  }}
                >
                  Чтобы снова войти, понадобится логин и пароль родителя.
                </div>

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
                      color: WHITE,
                    }}
                  >
                    Выйти
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
        </ModalPortal>
      ) : null}

      {loggingOut ? <LogoutOverlay /> : null}
    </div>
  );
}
