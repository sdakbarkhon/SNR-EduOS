import { SERVICE_ICON, ServiceSoonScreen } from "../_service-kit";

/** «Питание» — заглушка: сервиса столовой в проекте нет (ни таблицы меню,
 *  ни счёта, ни списаний). Та же страница отдаётся с /parent/meals. */
export default function ParentServiceMealsPage() {
  return (
    <ServiceSoonScreen
      title="Питание"
      backHref="/parent/services"
      description="Меню на неделю, баланс счёта в столовой и история списаний за обеды."
      paths={SERVICE_ICON.meals}
    />
  );
}
