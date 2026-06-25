"use client";

// Dynamic stdin fields (Prompt 16). One value per cell in a 5-column grid, with
// add / remove and a "paste from clipboard" button that splits pasted text on
// whitespace / comma / semicolon / newline. Values are joined with "\n" by the
// caller before being sent to the code runner as stdin.

import { useRef } from "react";
import { Clipboard, Plus, X } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

export function StdinInput({
  value, onChange, readOnly = false,
}: {
  value: string[];
  onChange: (vals: string[]) => void;
  readOnly?: boolean;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dc = d.lesson.code;
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const list = value.length > 0 ? value : [""];

  function addValue() {
    onChange([...value, ""]);
    // focus the freshly added field after render
    requestAnimationFrame(() => {
      const el = inputsRef.current[value.length];
      el?.focus();
    });
  }
  function removeValue(i: number) {
    const next = value.filter((_, idx) => idx !== i);
    onChange(next.length > 0 ? next : [""]);
  }
  function updateValue(i: number, v: string) {
    const next = value.length > 0 ? [...value] : [""];
    next[i] = v;
    onChange(next);
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = text.split(/[\s,;\n]+/).map((s) => s.trim()).filter(Boolean);
      if (parsed.length > 0) onChange(parsed);
    } catch {
      // Clipboard read blocked (permissions / insecure context) — no-op;
      // the user can still type values manually.
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (i === list.length - 1) addValue();
      else inputsRef.current[i + 1]?.focus();
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      {!readOnly && (
        <button
          type="button"
          onClick={handlePaste}
          className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-600"
        >
          <Clipboard className="h-3.5 w-3.5" />
          {dc.stdinPaste}
        </button>
      )}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {list.map((v, i) => (
          <div key={i} className="relative">
            <input
              ref={(el) => { inputsRef.current[i] = el; }}
              type="text"
              value={v}
              readOnly={readOnly}
              onChange={(e) => updateValue(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              placeholder={`#${i + 1}`}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center font-mono text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 read-only:opacity-70"
            />
            {!readOnly && list.length > 1 && (
              <button
                type="button"
                onClick={() => removeValue(i)}
                aria-label="remove"
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-transform hover:scale-110"
              >
                <X className="h-2.5 w-2.5" strokeWidth={3} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        {!readOnly ? (
          <button
            type="button"
            onClick={addValue}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            {dc.stdinAdd}
          </button>
        ) : <span />}
        <span className="text-xs font-medium text-slate-400">
          {dc.stdinTotal}: {list.filter((s) => s !== "").length}
        </span>
      </div>
    </div>
  );
}
