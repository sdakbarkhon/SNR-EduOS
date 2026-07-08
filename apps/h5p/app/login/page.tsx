"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithUsername } from "@snr/core";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const db = createClient();
    const result = await signInWithUsername(db, username, password);
    setLoading(false);
    if (result.error || !result.role) {
      setError("Неверный логин или пароль");
      return;
    }
    router.push(params.get("next") || "/library");
    router.refresh();
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form
        onSubmit={handleSubmit}
        style={{
          background: "white", borderRadius: 20, padding: 32, width: 340,
          boxShadow: "0 8px 24px rgba(93,80,150,0.12)",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>SNR EduOS H5P</h1>
        <p style={{ fontSize: 13, color: "#6f6f8c", marginBottom: 20 }}>Вход тем же логином, что и в основном приложении</p>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Логин</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e0ddf0", marginBottom: 14 }}
          autoFocus
        />
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Пароль</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e0ddf0", marginBottom: 14 }}
        />
        {error && <p style={{ color: "#e11d48", fontSize: 13, marginBottom: 10 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg,#FF9A3D,#FF6B3D)", color: "white", fontWeight: 800, cursor: "pointer",
          }}
        >
          {loading ? "Вход..." : "Войти"}
        </button>
      </form>
    </div>
  );
}
