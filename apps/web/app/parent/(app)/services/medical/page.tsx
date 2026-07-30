import { SERVICE_ICON, ServiceSoonScreen } from "../_service-kit";

/** «Медкарта» — заглушка: медицинских данных ученика проект не хранит. */
export default function ParentServiceMedicalPage() {
  return (
    <ServiceSoonScreen
      title="Медкарта"
      backHref="/parent/services"
      description="Медицинские справки, прививки, аллергии и особенности здоровья ученика."
      paths={SERVICE_ICON.medical}
    />
  );
}
