"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/actions/auth";

/** Промт «скорость», Задача 6: раньше — <form action={signOut}>, клик ждал
 *  полный server-action round trip (auth + БД до Frankfurt) до навигации.
 *  Клиентский редирект СРАЗУ + signOut() в фоне (та же схема, что уже
 *  использует TeacherSidebar.handleLogout()) — единая реализация. */
export function LogoutButton() {
  const router = useRouter();

  function handleClick() {
    router.replace("/login");
    signOut().catch(() => {});
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Выйти"
      className="text-text-muted transition hover:text-danger"
    >
      <LogOut size={20} />
    </button>
  );
}
