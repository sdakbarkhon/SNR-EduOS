"use client";

import { LogOut } from "lucide-react";
import { useLogout, LogoutOverlay } from "./LogoutOverlay";

/** Единый паттерн выхода для всех ролей — см. LogoutOverlay.tsx. */
export function LogoutButton() {
  const { loggingOut, logout } = useLogout();

  return (
    <>
      <button
        type="button"
        onClick={logout}
        aria-label="Выйти"
        className="text-text-muted transition hover:text-danger"
      >
        <LogOut size={20} />
      </button>
      {loggingOut && <LogoutOverlay />}
    </>
  );
}
