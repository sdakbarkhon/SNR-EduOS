"use client";

import { useState } from "react";
import { FolderOpen, Library } from "lucide-react";
import type { MaterialWithGroup, Book } from "@snr/core";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components";
import { MaterialsView } from "../materials/MaterialsView";
import { BooksView } from "../books/BooksView";

type Tab = "materials" | "library";

export function KnowledgeBaseView({
  materials,
  initialBooks,
  initialFavoriteIds,
  studentId,
  coverUrls,
}: {
  materials: MaterialWithGroup[];
  initialBooks: Book[];
  initialFavoriteIds: string[];
  studentId: string;
  coverUrls: Record<string, string>;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).knowledgeBase;
  const [tab, setTab] = useState<Tab>("library");

  return (
    <div className="text-slate-800">
      <h1 className="mb-5 text-3xl font-bold tracking-tight text-slate-800">{d.title}</h1>

      <div className="mb-6 flex gap-2 rounded-2xl bg-slate-100/80 p-1.5">
        <button
          onClick={() => setTab("library")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
            tab === "library" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Library className="h-4 w-4" /> {d.tabLibrary}
        </button>
        <button
          onClick={() => setTab("materials")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
            tab === "materials" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <FolderOpen className="h-4 w-4" /> {d.tabGroupMaterials}
        </button>
      </div>

      <div className={tab === "library" ? "" : "hidden"}>
        <BooksView
          initialBooks={initialBooks}
          initialFavoriteIds={initialFavoriteIds}
          studentId={studentId}
          coverUrls={coverUrls}
          hideHeading
        />
      </div>
      <div className={tab === "materials" ? "" : "hidden"}>
        <MaterialsView materials={materials} hideHeading />
      </div>
    </div>
  );
}
