import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";

/** Кнопка выхода — серверный action signOut() + redirect (полная навигация,
 *  без застрявшего клиентского состояния, F5 не нужен). Единая реализация. */
export function LogoutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        aria-label="Выйти"
        className="text-text-muted transition hover:text-danger"
      >
        <LogOut size={20} />
      </button>
    </form>
  );
}
