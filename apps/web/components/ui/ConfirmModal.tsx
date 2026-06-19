"use client";

import { useEffect, type ReactNode } from "react";
import { X, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "info" | "warning" | "danger";

const V = {
  info:    { Icon: Info,          iconCls: "text-blue-500",   btnCls: "bg-blue-600 hover:bg-blue-700 shadow-blue-500/25" },
  warning: { Icon: AlertTriangle, iconCls: "text-orange-500", btnCls: "bg-orange-500 hover:bg-orange-600 shadow-orange-500/25" },
  danger:  { Icon: AlertCircle,   iconCls: "text-red-500",    btnCls: "bg-red-600 hover:bg-red-700 shadow-red-500/25" },
};

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message?: string;
  icon?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: Variant;
  children?: ReactNode;
}

export function ConfirmModal({
  open, onClose, onConfirm,
  title, message, icon,
  confirmText, cancelText,
  variant = "info",
  children,
}: Props) {
  const { Icon, iconCls, btnCls } = V[variant];

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-md animate-[scale-in_0.2s_ease-out] rounded-[24px] border border-white/80 bg-white p-6 shadow-2xl"
        style={{ animation: "scaleIn 0.2s ease-out" }}
      >
        <style>{`@keyframes scaleIn{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}`}</style>

        {/* Close */}
        <button onClick={onClose} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
          <X size={16} />
        </button>

        {/* Icon + Title */}
        <div className="mb-4 flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            {icon ?? <Icon className={cn("h-6 w-6", iconCls)} />}
          </div>
          <h3 className="text-[17px] font-bold text-slate-900 leading-snug">{title}</h3>
        </div>

        {/* Message */}
        {message && (
          <p className="mb-4 text-[14px] leading-relaxed text-gray-600">{message}</p>
        )}

        {/* Custom children (e.g. list of names) */}
        {children && <div className="mb-4">{children}</div>}

        {/* Buttons */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {cancelText && (
            <button
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 transition-all hover:bg-gray-50"
            >
              {cancelText}
            </button>
          )}
          {onConfirm && confirmText && (
            <button
              onClick={() => { onConfirm(); onClose(); }}
              className={cn(
                "rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all active:scale-95",
                btnCls,
              )}
            >
              {confirmText}
            </button>
          )}
          {!onConfirm && (
            <button
              onClick={onClose}
              className={cn(
                "rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all active:scale-95",
                btnCls,
              )}
            >
              {confirmText ?? "Понятно"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
