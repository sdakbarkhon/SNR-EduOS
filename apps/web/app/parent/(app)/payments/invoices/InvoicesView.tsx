"use client";

/**
 * Экран «Счета и чеки» (d21) — веб-порт
 * apps/mobile-parent/src/screens/payments/ReceiptsScreen.tsx (макет
 * «SNR EduOS v2 Light.dc.html», строки 995–1031).
 *
 * Композиция:
 *  1. Два таба «Чеки» / «Счета» (SegmentPills из общего screen-kit).
 *  2. Группы: заголовок + строки. Строка — плитка категории 38, название и
 *     дата, номер документа, сумма (у счетов — ещё чип статуса «Оплачен» /
 *     «К оплате до …») и круглая кнопка скачивания.
 *     Чеки сгруппированы по месяцам, счета — ПО СРОКУ («К оплате сейчас» /
 *     «Позже» / «Оплаченные»), и у групп с долгом справа стоит их итог. Это
 *     не косметика: экран открывается по ссылке «Смотреть все ›» с карточки
 *     «К оплате сейчас» на /parent/payments, и группа с тем же названием
 *     обязана показывать ровно те же два счёта и ту же сумму 4 950 000.
 *  3. Синяя info-плашка про электронное хранение документов.
 *
 * ЧТО ОТЛИЧАЕТСЯ ОТ МОБИЛКИ. Там кнопка скачивания вела на stub-экран «file»,
 * здесь файлов нет вообще (их формирует платёжный провайдер, которого нет),
 * поэтому нажатие раскрывает под самой строкой SoonNote с объяснением —
 * родитель видит ответ там, где нажал. Кнопок «Поиск» и «Фильтры» в шапке
 * нет: в мобилке они вели на несуществующие в вебе экраны, а список из
 * 5–6 строк в поиске не нуждается.
 */

import { useState } from "react";
import { GlassCard } from "../../v2/GlassCard";
import {
  Glyph,
  IconTile,
  ScreenScroll,
  SectionCap,
  SegmentPills,
  StatusChip,
} from "../../_ui/screen-kit";
import { chip, ink1, ink2, ink3, status } from "../../v2/tokens";
import {
  CHECK_MONTHS,
  INVOICE_MONTHS,
  PAY_VISUAL,
  SOON_FILE,
  formatMoney,
  unpaidGroupNote,
  type ReceiptRow,
} from "../../_demo/demo-data";
import { PAY_GLYPH, NoticeBanner, SoonNote } from "../parts";

const TABS = ["Чеки", "Счета"] as const;

function ReceiptCard({
  row,
  soon,
  onDownload,
}: {
  row: ReceiptRow;
  soon: boolean;
  onDownload: () => void;
}) {
  const visual = PAY_VISUAL[row.visual];
  const violetChip = chip(status.violet.rgb);

  return (
    <div>
      <GlassCard variant="glass2" radius={16} style={{ padding: 12 }}>
        <div className="flex items-center" style={{ gap: 10 }}>
          <IconTile gradient={visual.gradient} paths={visual.paths} size={38} glyphSize={18} />

          <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 1 }}>
            <div className="flex items-center justify-between" style={{ gap: 8 }}>
              <span
                className="min-w-0 truncate"
                style={{ fontSize: 12, fontWeight: 800, color: ink1 }}
              >
                {row.title}
              </span>
              <span className="shrink-0" style={{ fontSize: 9, fontWeight: 700, color: ink3 }}>
                {row.dateLabel}
              </span>
            </div>
            <span className="truncate" style={{ fontSize: 9.5, fontWeight: 700, color: ink2 }}>
              {row.numberLabel}
            </span>
            <div className="flex items-center" style={{ gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: ink1 }}>
                {formatMoney(row.amount, { withCurrency: true })}
              </span>
              {row.statusLabel ? (
                <StatusChip
                  label={row.statusLabel}
                  family={row.statusPaid ? "green" : "orange"}
                  fontSize={8.5}
                />
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onDownload}
            aria-label={`Скачать: ${row.numberLabel}`}
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{
              width: 32,
              height: 32,
              background: violetChip.background,
              border: `1px solid ${violetChip.borderColor}`,
            }}
          >
            <Glyph
              paths={PAY_GLYPH.download}
              size={13}
              color={status.violet.text}
              strokeWidth={2}
            />
          </button>
        </div>
      </GlassCard>
      {soon ? <SoonNote text={SOON_FILE} /> : null}
    </div>
  );
}

export function InvoicesView({ isDemo: _isDemo }: {
  /**
   * Демо ли смотрящий (`schools.is_demo`, заход 1 по оплатам). ПОКА НЕ
   * ИСПОЛЬЗУЕТСЯ И ЭТО НАМЕРЕННО: заход 1 только доводит признак до экрана,
   * ветвиться будет заход 2, когда деньги переедут на настоящие счета. До
   * тех пор заготовка видна обоим — и гостю, и настоящему родителю.
   */
  isDemo: boolean;
}) {
  const [tabIndex, setTabIndex] = useState(0);
  const [soonId, setSoonId] = useState<string | null>(null);

  const months = tabIndex === 0 ? CHECK_MONTHS : INVOICE_MONTHS;

  return (
    <ScreenScroll gap={11}>
      <SegmentPills
        items={TABS}
        activeIndex={tabIndex}
        onChange={(i) => {
          setTabIndex(i);
          setSoonId(null);
        }}
      />

      {months.map((month) => (
        <div key={`${tabIndex}-${month.id}`} className="flex flex-col" style={{ gap: 11 }}>
          <div className="flex items-baseline justify-between" style={{ gap: 8 }}>
            <SectionCap label={month.label} tone="ink3" />
            {(() => {
              const note = unpaidGroupNote(month.rows);
              return note ? (
                <span className="shrink-0" style={{ fontSize: 9.5, fontWeight: 800, color: ink2 }}>
                  {note}
                </span>
              ) : null;
            })()}
          </div>
          {month.rows.map((row) => (
            <ReceiptCard
              key={row.id}
              row={row}
              soon={soonId === row.id}
              onDownload={() => setSoonId(soonId === row.id ? null : row.id)}
            />
          ))}
        </div>
      ))}

      <NoticeBanner
        family="blue"
        text="Все документы хранятся в электронном виде и доступны в любой момент. Любой чек или счёт можно будет скачать в PDF и отправить на почту."
      />
    </ScreenScroll>
  );
}
