// P2 мобильный DemoSession: persistent SecureStore key snr_demo_session_token
// + heartbeat 5 мин + текущий флаг isDemo для баннера. Провайдер живёт над
// RootNavigator в App.tsx.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { heartbeatDemoSlot, releaseDemoSlot } from "../lib/demoApi";

const STORAGE_KEY = "snr_demo_session_token";
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

interface DemoSessionState {
  isDemo: boolean;
  sessionToken: string | null;
  /** Сохраняет токен в SecureStore и включает флаг isDemo. */
  setDemoSession: (token: string) => Promise<void>;
  /** Release-lease + очистка SecureStore + сброс isDemo. */
  clearDemoSession: () => Promise<void>;
}

const DemoSessionContext = createContext<DemoSessionState | null>(null);

export function useDemoSession(): DemoSessionState {
  const ctx = useContext(DemoSessionContext);
  if (!ctx) throw new Error("useDemoSession must be inside DemoSessionProvider");
  return ctx;
}

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Загружаем токен из SecureStore на mount — если приложение перезапустили
  // с активной lease, продолжаем баннер + heartbeat.
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (stored) setSessionToken(stored);
      } catch {
        // secure-store недоступен — считаем что демо неактивно
      }
    })();
  }, []);

  const setDemoSession = useCallback(async (token: string) => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, token);
    } catch (e) {
      console.error("[DemoSession] failed to persist token:", e);
    }
    setSessionToken(token);
  }, []);

  const clearDemoSession = useCallback(async () => {
    const token = sessionToken;
    setSessionToken(null);
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    } catch {
      // ignore
    }
    if (token) {
      await releaseDemoSlot(token);
    }
  }, [sessionToken]);

  // Heartbeat пока токен активен.
  useEffect(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (!sessionToken) return;

    const tick = async () => {
      const alive = await heartbeatDemoSlot(sessionToken);
      if (!alive) {
        // lease протух — снимаем локальное состояние (release не нужен —
        // сервер уже пометил released_at при sweep).
        setSessionToken(null);
        try { await SecureStore.deleteItemAsync(STORAGE_KEY); } catch {}
      }
    };
    // сразу один tick + периодический
    void tick();
    heartbeatRef.current = setInterval(tick, HEARTBEAT_INTERVAL_MS);
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [sessionToken]);

  const value = useMemo<DemoSessionState>(() => ({
    isDemo: sessionToken != null,
    sessionToken,
    setDemoSession,
    clearDemoSession,
  }), [sessionToken, setDemoSession, clearDemoSession]);

  return (
    <DemoSessionContext.Provider value={value}>
      {children}
    </DemoSessionContext.Provider>
  );
}
