"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CardDraft = { file: File | null; description: string; previewUrl: string | null };

const EMPTY_CARD: CardDraft = { file: null, description: "", previewUrl: null };

// Fixed H5P.MemoryGame l10n/behaviour defaults -- same shape as the official
// demo content served by the H5P Hub (api.h5p.org), see the УЧ.9 report.
const L10N_DEFAULTS = {
  cardTurns: "Card turns",
  timeSpent: "Time spent",
  feedback: "Good work!",
  tryAgain: "Reset",
  closeLabel: "Close",
  label: "Memory Game. Find the matching cards.",
  done: "All of the cards have been found.",
  cardPrefix: "Card %num:",
  cardUnturned: "Unturned.",
  cardMatched: "Match found.",
  cardTurned: "Turned.",
  cardMatchedA11y: "Your cards match!",
  cardNotMatchedA11y: "Your chosen cards do not match. Turn other cards to try again.",
};

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function EditorForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [cards, setCards] = useState<CardDraft[]>([{ ...EMPTY_CARD }, { ...EMPTY_CARD }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateCard(i: number, patch: Partial<CardDraft>) {
    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function onFileChange(i: number, file: File | null) {
    const previewUrl = file ? URL.createObjectURL(file) : null;
    updateCard(i, { file, previewUrl });
  }

  function addCard() {
    if (cards.length >= 8) return;
    setCards((prev) => [...prev, { ...EMPTY_CARD }]);
  }

  function removeCard(i: number) {
    if (cards.length <= 2) return;
    setCards((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const readyCards = cards.filter((c) => c.file);
    if (!title.trim()) { setError("Укажите название задания"); return; }
    if (readyCards.length < 2) { setError("Загрузите минимум 2 картинки"); return; }

    setSaving(true);
    try {
      const db = createClient();
      const contentId = crypto.randomUUID();
      const bucket = "h5p-content";

      const cardEntries = [];
      for (let i = 0; i < readyCards.length; i++) {
        const card = readyCards[i]!;
        const file = card.file as File;
        const ext = file.name.split(".").pop() || "jpg";
        const storagePath = `${contentId}/content/images/card-${i}.${ext}`;
        const { error: uploadError } = await db.storage.from(bucket).upload(storagePath, file, {
          contentType: file.type || "image/jpeg",
          upsert: true,
        });
        if (uploadError) throw uploadError;
        const dims = await readImageDimensions(file).catch(() => ({ width: 400, height: 400 }));
        cardEntries.push({
          description: card.description.trim() || undefined,
          image: {
            path: `images/card-${i}.${ext}`,
            mime: file.type || "image/jpeg",
            width: dims.width,
            height: dims.height,
          },
          imageAlt: card.description.trim() || `Card ${i + 1}`,
        });
      }

      const contentJson = {
        cards: cardEntries,
        l10n: L10N_DEFAULTS,
        behaviour: { useGrid: true, allowRetry: true },
        lookNFeel: { themeColor: "#7C5CFF" },
      };
      const h5pJson = {
        title: title.trim(),
        language: "und",
        mainLibrary: "H5P.MemoryGame",
        embedTypes: ["div"],
        license: "U",
        defaultLanguage: "ru",
        preloadedDependencies: [
          { machineName: "H5P.MemoryGame", majorVersion: "1", minorVersion: "3" },
          { machineName: "FontAwesome", majorVersion: "4", minorVersion: "5" },
          { machineName: "H5P.Timer", majorVersion: "0", minorVersion: "4" },
        ],
      };

      const enc = new TextEncoder();
      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        db.storage.from(bucket).upload(`${contentId}/content/content.json`, enc.encode(JSON.stringify(contentJson)), {
          contentType: "application/json", upsert: true,
        }),
        db.storage.from(bucket).upload(`${contentId}/h5p.json`, enc.encode(JSON.stringify(h5pJson)), {
          contentType: "application/json", upsert: true,
        }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const { error: insertError } = await db.from("h5p_content").insert({
        id: contentId,
        title: title.trim(),
        content_type: "H5P.MemoryGame",
        storage_path: contentId,
        is_public: false,
      });
      if (insertError) throw insertError;

      router.push(`/player/${contentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Название задания</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Например: Фрукты и ягоды"
        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e0ddf0", marginBottom: 20 }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14, marginBottom: 16 }}>
        {cards.map((card, i) => (
          <div key={i} style={{ background: "white", borderRadius: 14, padding: 12, boxShadow: "0 4px 14px rgba(93,80,150,0.08)" }}>
            <div
              style={{
                width: "100%", aspectRatio: "1", borderRadius: 10, background: "#f3eeff",
                display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 8,
              }}
            >
              {card.previewUrl
                ? <img src={card.previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ color: "#b8b0e0", fontSize: 28 }}>🖼️</span>}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onFileChange(i, e.target.files?.[0] ?? null)}
              style={{ fontSize: 11, marginBottom: 6, width: "100%" }}
            />
            <input
              value={card.description}
              onChange={(e) => updateCard(i, { description: e.target.value })}
              placeholder="Подпись (опц.)"
              style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: "1px solid #e0ddf0", fontSize: 12, marginBottom: 6 }}
            />
            {cards.length > 2 && (
              <button type="button" onClick={() => removeCard(i)} style={{ fontSize: 11, color: "#e11d48", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Удалить
              </button>
            )}
          </div>
        ))}
      </div>

      {cards.length < 8 && (
        <button
          type="button"
          onClick={addCard}
          style={{ marginBottom: 20, padding: "8px 14px", borderRadius: 10, border: "1px dashed #b8b0e0", background: "none", color: "#7c5cff", fontWeight: 700, cursor: "pointer" }}
        >
          + Добавить карточку
        </button>
      )}

      {error && <p style={{ color: "#e11d48", fontSize: 13, marginBottom: 14 }}>{error}</p>}

      <button
        type="submit"
        disabled={saving}
        style={{
          width: "100%", padding: "12px 16px", borderRadius: 12, border: "none",
          background: "linear-gradient(135deg,#FF9A3D,#FF6B3D)", color: "white", fontWeight: 800, fontSize: 15, cursor: "pointer",
        }}
      >
        {saving ? "Сохранение..." : "Сохранить и открыть"}
      </button>
    </form>
  );
}
