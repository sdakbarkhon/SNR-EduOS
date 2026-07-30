import { SERVICE_ICON, ServiceSoonScreen } from "../_service-kit";

/** «Транспорт» — заглушка: маршрутов и трекинга автобуса в проекте нет. */
export default function ParentServiceTransportPage() {
  return (
    <ServiceSoonScreen
      title="Транспорт"
      backHref="/parent/services"
      description="Маршрут школьного автобуса, время подачи и уведомления о посадке и высадке ребёнка."
      paths={SERVICE_ICON.transport}
    />
  );
}
