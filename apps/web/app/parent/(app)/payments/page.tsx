import { PaymentsView } from "./PaymentsView";

/**
 * «Оплаты» (П17) — редизайн v2. Экран полностью перенесён 1:1 из мобильного
 * apps/mobile-parent/src/screens/tabs/PaymentsScreen.tsx (ветка
 * `feat/mobile-parent-redesign`) и читает данные ТОЛЬКО из фикстур
 * app/parent/(app)/v2/data (точная копия data-слоя мобилки) — теми же
 * аксессорами, что и RN-экран. Поэтому серверных props здесь больше нет:
 * прежняя версия тянула ребёнка из cookie и WALLETS из @snr/core, теперь
 * единственный источник чисел — v2/data (getSelectedChildContext и др.),
 * чтобы веб и мобилка не расходились.
 *
 * Авторизация/редирект — на уровне layout.tsx этого сегмента.
 */
export default function ParentPaymentsPage() {
  return <PaymentsView />;
}
