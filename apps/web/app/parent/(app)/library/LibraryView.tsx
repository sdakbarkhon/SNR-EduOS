"use client";

/**
 * Разметка «Библиотеки». Клиентский компонент ради словаря (см. TestsView).
 *
 * Предмет у книги хранится КЛЮЧОМ (`math`, `programming`), а не названием —
 * поэтому подпись берём из общего конфига `subjects` (@snr/core), того же,
 * что красит предметы у ученика и учителя. Свой список названий здесь заводить
 * нельзя: он разъедется с остальным приложением при первом же новом предмете.
 */

import { useState, useTransition } from "react";
import type { Locale } from "@snr/core";
import { getDictionary, resolveSubject } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import type { LibraryBookItem } from "@/lib/parent-queries";
import { GlassCard } from "../v2/GlassCard";
import { EmptyState, ICON, IconTile, InnerHeader, ScreenScroll, SectionCap, StatusChip } from "../_ui/screen-kit";
import { getBookFileUrl } from "@/app/actions/books";
import { DIVIDER } from "../_ui/screen-tokens";
import { avatarGradient } from "../_ui/format";
import { accentGrad, ink1, ink2, ink3 } from "../v2/tokens";

export function LibraryView({ books }: { books: LibraryBookItem[] }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;
  const m = d.more;
  const m2 = d.more2;
  // Какую книгу сейчас открываем и что сломалось — по одной за раз, так что
  // хватает двух идентификаторов вместо карты состояний.
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  /** Открыть файл книги. Ссылку подписывает то же серверное действие, что
   *  и у ученика с учителем; своей копии подписывания здесь нет. */
  function openBook(id: string) {
    setFailedId(null);
    setOpeningId(id);
    startTransition(async () => {
      const url = await getBookFileUrl(id);
      setOpeningId(null);
      if (!url) {
        setFailedId(id);
        return;
      }
      // Новая вкладка, а не переход: возвращаться из просмотрщика браузера
      // в приложение кнопкой «назад» — неудобно на телефоне.
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title={d.scr.library} backHref="/parent/services" />

      <ScreenScroll>
        {books.length === 0 ? (
          <GlassCard radius={22}>
            <EmptyState title={m.libraryEmptyTitle} text={m.libraryEmptyText} paths={ICON.doc} />
          </GlassCard>
        ) : (
          <>
            <SectionCap label={m.libraryCount.replace("{n}", String(books.length))} />

            <GlassCard radius={22} style={{ paddingLeft: 14, paddingRight: 14 }}>
              {books.map((b, idx) => {
                const subjectLabel = resolveSubject({ catalog: b.catalog, slug: b.subject }).label;
                const hasContent = Boolean(b.file_storage_path || b.external_url);
                return (
                  <div
                    key={b.id}
                    className="flex"
                    style={{
                      gap: 11,
                      paddingTop: 12,
                      paddingBottom: 12,
                      borderTop: idx > 0 ? `1px solid ${DIVIDER}` : undefined,
                    }}
                  >
                    <IconTile gradient={avatarGradient(b.subject)} paths={ICON.doc} />

                    <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 3 }}>
                      <div className="flex items-start" style={{ gap: 8 }}>
                        <span
                          className="min-w-0 flex-1"
                          style={{ fontSize: 12, fontWeight: 800, color: ink1 }}
                        >
                          {b.title}
                        </span>
                        {b.isFavorite ? <StatusChip label={m.libraryFav} family="orange" /> : null}
                      </div>

                      <span style={{ fontSize: 9.5, fontWeight: 600, color: ink2 }}>
                        {[b.book_type, subjectLabel, b.author].filter(Boolean).join(" · ")}
                      </span>

                      {b.description ? (
                        <span
                          className="line-clamp-2"
                          style={{ fontSize: 10, fontWeight: 600, lineHeight: "15px", color: ink2 }}
                        >
                          {b.description}
                        </span>
                      ) : null}

                      {hasContent ? (
                        <span className="flex items-center" style={{ gap: 8, marginTop: 2 }}>
                          <button
                            type="button"
                            onClick={() => openBook(b.id)}
                            disabled={openingId === b.id}
                            className="rounded-full"
                            style={{
                              padding: "5px 12px",
                              fontSize: 10,
                              fontWeight: 800,
                              color: "#FFFFFF",
                              background: accentGrad,
                              opacity: openingId === b.id ? 0.6 : 1,
                            }}
                          >
                            {openingId === b.id ? m2.libraryOpening : m2.libraryOpen}
                          </button>
                          {failedId === b.id ? (
                            <span style={{ fontSize: 9, fontWeight: 700, color: "var(--p-status-red-text, #B91C1C)" }}>
                              {m2.libraryOpenFailed}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span style={{ fontSize: 9, fontWeight: 700, color: ink3 }}>{m.libraryNoFile}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </GlassCard>
          </>
        )}
      </ScreenScroll>
    </div>
  );
}
