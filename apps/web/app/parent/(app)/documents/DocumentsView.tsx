"use client";

/**
 * Экран #31 «Документы» — веб-порт
 * apps/mobile-parent/src/screens/profile/DocumentsScreen.tsx (макет
 * «SNR EduOS v2 Light.dc.html», строки 1247–1274).
 *
 * Композиция:
 *  1. Зелёный security-баннер «Мы защищаем ваши данные».
 *  2. «Документы ребёнка» — карточки: иконка типа, название, подпись
 *     (владелец · формат · размер), дата и кнопка «Скачать».
 *  3. «Документы родителя» — та же карточка.
 *  4. Футнот про поддерживаемые форматы.
 *
 * ЧТО ОТЛИЧАЕТСЯ ОТ МОБИЛКИ. Строка документа в RN была Pressable с шевроном
 * и вела на просмотр файла (stub «file»); кнопка «Добавить документ» — на
 * stub «adddoc». В вебе файлов нет вовсе (ни таблицы, ни бакета Storage),
 * поэтому:
 *   * вместо шеврона у каждой карточки явная кнопка «Скачать» — по ней
 *     раскрывается объяснение, почему файл пока недоступен;
 *   * кнопки «Добавить документ» нет: загружать физически некуда, а кнопка
 *     ради кнопки — это ровно то, что мы здесь и убираем.
 *
 * ДАННЫЕ — МОК (списка документов в БД не существует), но привязанный к
 * настоящей семье: ФИО ребёнка, его класс и ФИО родителя приходят с сервера,
 * см. page.tsx.
 */

import Link from "next/link";
import { useState } from "react";
import { GlassCard } from "../v2/GlassCard";
import {
  DIVIDER,
  Glyph,
  ICON,
  IconTile,
  ScreenScroll,
  SectionCap,
} from "../_ui/screen-kit";
import { chip, ink1, ink2, ink3, status } from "../v2/tokens";

interface DocItem {
  id: string;
  name: string;
  /** «Владелец/предмет документа · формат · размер» — вторая строка карточки. */
  meta: string;
  dateLabel: string;
  gradient: readonly [string, string];
  paths: readonly string[];
}

/** Почему файла нет — один и тот же ответ для всех кнопок «Скачать». */
const SOON_TEXT =
  "Функция появится скоро: файлы документов ещё не загружены в систему. Нужную копию можно запросить в чате поддержки школы.";

function buildChildDocs(childName: string, className: string): DocItem[] {
  const owner = childName || "Ученик";
  // ВНИМАНИЕ: className из БД — это ЦЕЛИКОМ название группы, уже со словом
  // «класс» («10-А класс»: getParentContext берёт группу по n.includes("класс")).
  // Дописывать «класс» второй раз нельзя — было «Обучение в 10-А класс класс».
  const group = className.trim();
  return [
    {
      id: "birth",
      name: "Свидетельство о рождении",
      meta: `${owner} · PDF · 1,2 МБ`,
      dateLabel: "Добавлен 12 января 2026",
      gradient: ["#60a5fa", "#2563eb"],
      paths: ICON.doc,
    },
    {
      id: "school-ref",
      name: "Справка из школы",
      // Без класса фраза «Обучение в …» повисает — тогда даём нейтральный вариант.
      meta: group ? `Обучение в ${group} · PDF · 340 КБ` : "Подтверждение обучения · PDF · 340 КБ",
      dateLabel: "Выдана 21 июля 2026",
      gradient: ["#34d399", "#059669"],
      paths: ICON.checkSquare,
    },
  ];
}

function buildParentDocs(parentName: string): DocItem[] {
  // Владелец, а не «Договор об обучении»: подпись карточки описывает САМ
  // документ (ID-карту), а не другой документ семьи — во всех остальных
  // карточках в этой позиции стоит владелец.
  const owner = parentName || "Родитель";
  return [
    {
      id: "parent-id",
      name: "ID-карта родителя",
      meta: `${owner} · JPG · 2,1 МБ`,
      dateLabel: "Добавлена 3 сентября 2025",
      gradient: ["#a78bfa", "#7c3aed"],
      paths: ICON.card,
    },
  ];
}

function DocRow({
  doc,
  divider,
  soon,
  onDownload,
}: {
  doc: DocItem;
  divider: boolean;
  soon: boolean;
  onDownload: () => void;
}) {
  const violetChip = chip(status.violet.rgb);
  return (
    <div style={{ borderTop: divider ? `1px solid ${DIVIDER}` : undefined }}>
      <div className="flex items-center" style={{ gap: 11, paddingTop: 11, paddingBottom: 11 }}>
        <IconTile gradient={doc.gradient} paths={doc.paths} size={36} glyphSize={16} />
        <span className="flex min-w-0 flex-1 flex-col" style={{ gap: 2 }}>
          <span className="truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
            {doc.name}
          </span>
          <span className="truncate" style={{ fontSize: 9.5, fontWeight: 600, color: ink2 }}>
            {doc.meta}
          </span>
          <span style={{ fontSize: 9, fontWeight: 600, color: ink3 }}>{doc.dateLabel}</span>
        </span>
        <button
          type="button"
          onClick={onDownload}
          aria-expanded={soon}
          aria-label={`Скачать: ${doc.name}`}
          className="flex shrink-0 cursor-pointer items-center"
          style={{
            gap: 6,
            padding: "7px 10px",
            borderRadius: 999,
            background: violetChip.background,
            border: `1px solid ${violetChip.borderColor}`,
            fontSize: 10,
            fontWeight: 800,
            color: status.violet.text,
          }}
        >
          <Glyph
            paths={["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"]}
            size={12}
            color={status.violet.text}
            strokeWidth={2}
          />
          Скачать
        </button>
      </div>
      {soon ? (
        <p
          role="status"
          className="flex items-start"
          style={{
            gap: 8,
            marginBottom: 11,
            padding: "9px 11px",
            borderRadius: 12,
            background: violetChip.background,
            border: `1px solid ${violetChip.borderColor}`,
          }}
        >
          <span style={{ paddingTop: 1 }}>
            <Glyph paths={ICON.info} size={13} color={status.violet.text} strokeWidth={2} />
          </span>
          <span
            className="min-w-0 flex-1"
            style={{ fontSize: 10, fontWeight: 700, lineHeight: "15px", color: status.violet.text }}
          >
            {SOON_TEXT}{" "}
            {/* Обещание «запросите в чате» без ссылки — тупик: даём переход. */}
            <Link href="/parent/messages" style={{ textDecoration: "underline" }}>
              Открыть чат
            </Link>
          </span>
        </p>
      ) : null}
    </div>
  );
}

export function DocumentsView({
  childName,
  childClassName,
  parentName,
}: {
  childName: string | null;
  childClassName: string | null;
  parentName: string | null;
}) {
  const [soonId, setSoonId] = useState<string | null>(null);
  const toggle = (id: string) => () => setSoonId(soonId === id ? null : id);

  const childDocs = buildChildDocs(childName ?? "", childClassName ?? "");
  const parentDocs = buildParentDocs(parentName ?? "");

  return (
    <ScreenScroll>
      {/* 1. Security-баннер (макет 1254–1257). */}
      <div
        className="flex items-start"
        style={{
          gap: 10,
          padding: "12px 14px",
          borderRadius: 18,
          background: `rgba(${status.green.rgb},0.10)`,
          border: `1px solid rgba(${status.green.rgb},0.30)`,
        }}
      >
        <span style={{ paddingTop: 1 }}>
          <Glyph paths={ICON.shield} size={17} color={status.green.text} strokeWidth={1.9} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col" style={{ gap: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: ink1 }}>
            Мы защищаем ваши данные
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, lineHeight: "15px", color: ink2 }}>
            Документы хранятся в зашифрованном виде и доступны только вам и администрации школы.
          </span>
        </span>
      </div>

      {/* 2. Документы ребёнка. */}
      <SectionCap label="Документы ребёнка" />
      <GlassCard radius={20} style={{ padding: "0 14px" }}>
        {childDocs.map((doc, i) => (
          <DocRow
            key={doc.id}
            doc={doc}
            divider={i > 0}
            soon={soonId === doc.id}
            onDownload={toggle(doc.id)}
          />
        ))}
      </GlassCard>

      {/* 3. Документы родителя. */}
      <SectionCap label="Документы родителя" />
      <GlassCard radius={20} style={{ padding: "0 14px" }}>
        {parentDocs.map((doc, i) => (
          <DocRow
            key={doc.id}
            doc={doc}
            divider={i > 0}
            soon={soonId === doc.id}
            onDownload={toggle(doc.id)}
          />
        ))}
      </GlassCard>

      <span style={{ fontSize: 9, fontWeight: 600, color: ink3, textAlign: "center" }}>
        Нужен документ прямо сейчас?{" "}
        <Link href="/parent/messages" style={{ textDecoration: "underline" }}>
          Напишите в чат поддержки
        </Link>{" "}
        — школа пришлёт копию.
      </span>
    </ScreenScroll>
  );
}
