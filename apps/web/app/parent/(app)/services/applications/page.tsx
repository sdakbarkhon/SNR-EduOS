import { SERVICE_ICON, ServiceSoonScreen } from "../_service-kit";

/** «Заявления» — заглушка: документооборота с администрацией в проекте нет. */
export default function ParentServiceApplicationsPage() {
  return (
    <ServiceSoonScreen
      title="Заявления"
      backHref="/parent/services"
      description="Заявления на отпуск и справки, обращения в администрацию и статус их рассмотрения."
      paths={SERVICE_ICON.applications}
    />
  );
}
