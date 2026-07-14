import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getParentContext, type ParentContext as ParentContextData } from "@snr/core";
import { getSupabase } from "../lib/supabase";
import { useAsyncData } from "../hooks/useAsyncData";

type Ctx = {
  data: ParentContextData | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
  selectedChildId: string | null;
  selectChild: (id: string) => void;
};

const ParentDataContext = createContext<Ctx | null>(null);

/** Родитель+дети — загружаются ОДИН раз здесь (не в каждом из 7 экранов) и
 *  раздаются через контекст. Селектор ребёнка живёт тут же: >1 ребёнка —
 *  переключатель работает, 1 (или 0) — переключать нечего. */
export function ParentDataProvider({ children }: { children: ReactNode }) {
  const state = useAsyncData(() => getParentContext(getSupabase()), []);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  useEffect(() => {
    if (state.data && state.data.children.length > 0 && !selectedChildId) {
      setSelectedChildId(state.data.children[0].id);
    }
  }, [state.data, selectedChildId]);

  const value = useMemo<Ctx>(
    () => ({
      data: state.data,
      loading: state.loading,
      error: state.error,
      refresh: state.refresh,
      selectedChildId,
      selectChild: setSelectedChildId,
    }),
    [state.data, state.loading, state.error, state.refresh, selectedChildId],
  );

  return <ParentDataContext.Provider value={value}>{children}</ParentDataContext.Provider>;
}

export function useParentData(): Ctx {
  const ctx = useContext(ParentDataContext);
  if (!ctx) throw new Error("useParentData must be used within ParentDataProvider");
  return ctx;
}

export function useSelectedChild() {
  const { data, selectedChildId } = useParentData();
  return data?.children.find((c) => c.id === selectedChildId) ?? null;
}
