import { SERVICE_ICON, ServiceSoonScreen } from "../services/_service-kit";

/**
 * «Питание» с главной. На главной быстрое действие ведёт на /parent/meals
 * (HomeView.tsx, R.meals) — до этого маршрута не существовало и переход давал
 * 404. Содержимое то же, что у /parent/services/meals; отличается только
 * стрелка «назад» — сюда приходят с главной, туда со «Всех сервисов».
 *
 * Редиректом это делать нельзя: у двух точек входа разные родители, и
 * пользователь после «назад» уезжал бы не туда, откуда пришёл.
 */
export default function ParentMealsPage() {
  return (
    <ServiceSoonScreen
      title="Питание"
      backHref="/parent/home"
      description="Меню на неделю, баланс счёта в столовой и история списаний за обеды."
      paths={SERVICE_ICON.meals}
    />
  );
}
