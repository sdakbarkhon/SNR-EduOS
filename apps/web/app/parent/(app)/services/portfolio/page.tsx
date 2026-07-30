import { SERVICE_ICON, ServiceSoonScreen } from "../_service-kit";

/** «Портфолио» — заглушка: хранилища достижений и работ ученика в БД нет. */
export default function ParentServicePortfolioPage() {
  return (
    <ServiceSoonScreen
      title="Портфолио"
      backHref="/parent/services"
      description="Достижения, олимпиады, грамоты и творческие работы ученика — всё в одном месте."
      paths={SERVICE_ICON.portfolio}
    />
  );
}
