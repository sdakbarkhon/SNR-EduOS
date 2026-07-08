"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { getDictionary, type Locale, type CodeLanguage, type ExternalServiceType } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { EduOSAiIcon } from "@/components/EduOSAiIcon";
import { cn } from "@/lib/cn";
import { SERVICE_CONFIG, EXTERNAL_SERVICE_ORDER, isExternalService } from "@/lib/external-services";

export interface GeneratedHomework {
  title: string;
  description: string;
  config?: {
    questions?: Array<{ question: string; options: string[]; correctIndex: number }>; // type="test"
    starterCode?: string; language?: CodeLanguage; expectedOutput?: string;            // type="programming"
  };
  subtasks?: Array<{
    type: "file" | "test" | "code" | ExternalServiceType;
    title: string;
    description: string;
    config: Record<string, unknown>;
  }>; // type="bundle"
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  type: "file" | "test" | "programming" | "bundle";
  groupLabel: string; // e.g. "Математика — 7А", shown read-only as the auto-filled "level" context
  onApply: (data: GeneratedHomework) => void;
}

const BUNDLE_SUBTASK_TYPES = ["file", "test", "code", ...EXTERNAL_SERVICE_ORDER] as const;
type BundleSubtaskType = (typeof BUNDLE_SUBTASK_TYPES)[number];

function bundleTypeLabel(bt: BundleSubtaskType, d: ReturnType<typeof getDictionary>): string {
  if (isExternalService(bt)) return SERVICE_CONFIG[bt].name;
  switch (bt) {
    case "file": return d.homework.typeFile;
    case "test": return d.homework.typeTest;
    case "code": return d.homework.typeProgrammingShort;
    default: return bt;
  }
}

export function HomeworkAiGenerateModal({ isOpen, onClose, type, groupLabel, onApply }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.ai.generateHomework;

  const [topic, setTopic] = useState("");
  const [hints, setHints] = useState("");
  const [bundleTypes, setBundleTypes] = useState<Set<BundleSubtaskType>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // Reset transient state whenever the modal is (re)opened/closed so a
  // previous topic/error doesn't linger into the next open.
  useEffect(() => {
    if (!isOpen) {
      setTopic("");
      setHints("");
      setBundleTypes(new Set());
      setGenerating(false);
      setError("");
    }
  }, [isOpen]);

  function toggleBundleType(bt: BundleSubtaskType) {
    setBundleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(bt)) next.delete(bt);
      else next.add(bt);
      return next;
    });
  }

  async function generate() {
    if (!topic.trim() || generating) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/ai/generate-homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          topic: topic.trim(),
          level: groupLabel,
          hints: hints.trim() || undefined,
          ...(type === "bundle" && bundleTypes.size > 0
            ? { bundleSubtaskTypes: Array.from(bundleTypes) }
            : {}),
        }),
      });
      const data = (await res.json()) as GeneratedHomework & { error?: string };
      if (!res.ok || data.error) {
        setError(t.error);
        return;
      }
      onApply(data);
      onClose();
    } catch {
      setError(t.error);
    } finally {
      setGenerating(false);
    }
  }

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-6 py-4">
          <EduOSAiIcon className="h-9 w-9" />
          <h3 className="flex-1 text-[16px] font-bold text-brand-ink">{t.title}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-brand-ink-muted">{t.topicLabel}</span>
            <textarea
              rows={2}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t.topicPlaceholder}
              className="resize-none rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2.5 text-[14px] text-brand-ink focus:outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/20"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-brand-ink-muted">{t.levelLabel}</span>
            <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-brand-ink-muted">
              {groupLabel}
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-brand-ink-muted">{t.hintsLabel}</span>
            <textarea
              rows={2}
              value={hints}
              onChange={(e) => setHints(e.target.value)}
              placeholder={t.hintsPlaceholder}
              className="resize-none rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2.5 text-[14px] text-brand-ink focus:outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/20"
            />
          </label>

          {type === "bundle" && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-brand-ink-muted">{t.bundleTypesLabel}</span>
              <p className="text-[11px] text-slate-400">{t.bundleTypesHint}</p>
              <div className="flex flex-wrap gap-2">
                {BUNDLE_SUBTASK_TYPES.map((bt) => {
                  const active = bundleTypes.has(bt);
                  return (
                    <button
                      key={bt}
                      type="button"
                      onClick={() => toggleBundleType(bt)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all",
                        active
                          ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
                          : "border-slate-200 bg-white text-brand-ink-muted hover:bg-slate-50",
                      )}
                    >
                      {bundleTypeLabel(bt, d)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="text-[13px] font-medium text-danger">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-[12px] px-4 py-2.5 text-[14px] font-semibold text-brand-ink-muted hover:bg-slate-100"
          >
            {d.common.cancel}
          </button>
          <button
            onClick={() => void generate()}
            disabled={generating || !topic.trim()}
            className="flex items-center gap-2 rounded-[12px] px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)", boxShadow: "0 4px 16px rgba(29,111,245,0.35)" }}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {t.generating}
              </>
            ) : (
              t.generateBtn
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
