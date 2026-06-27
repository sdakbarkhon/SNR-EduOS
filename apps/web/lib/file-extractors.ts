// Server-side text extraction from uploaded lesson materials.
// Used by /api/ai/extract-files to feed file content into the AI lesson generator.
// Runs in the Node runtime only (never bundled — see serverExternalPackages).

import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const MAX_CHARS = 50_000;

export interface ExtractResult {
  text: string;
  truncated: boolean;
  pages?: number;
}

/** Extract plain text from a file buffer based on its MIME type or filename. */
export async function extractText(
  buffer: Buffer,
  mimeType: string,
  fileName = "",
): Promise<ExtractResult> {
  const mt = (mimeType || "").toLowerCase();
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();

  let text = "";
  let pages: number | undefined;

  try {
    if (mt.includes("pdf") || ext === "pdf") {
      const parser = new PDFParse({ data: buffer });
      try {
        const data = await parser.getText();
        text = data.text;
        pages = data.total;
      } finally {
        await parser.destroy().catch(() => {});
      }
    } else if (
      mt.includes("wordprocessing") || mt.includes("msword") ||
      ext === "docx" || ext === "doc"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (mt.includes("presentation") || ext === "pptx") {
      text = await extractPptxText(buffer);
    } else if (
      mt.startsWith("text/") || ext === "txt" || ext === "csv" || ext === "md"
    ) {
      text = buffer.toString("utf-8");
    } else {
      throw new Error(`Unsupported type: ${mimeType || ext || "unknown"}`);
    }
  } catch (err) {
    console.error("[file-extractors] extract error:", err);
    throw new Error("Не удалось извлечь текст из файла");
  }

  // Normalize whitespace.
  text = text.replace(/\s+/g, " ").trim();

  const truncated = text.length > MAX_CHARS;
  if (truncated) text = text.slice(0, MAX_CHARS);

  return { text, truncated, pages };
}

/**
 * PPTX is a ZIP of slide XML files. We pull the text out of every <a:t> run.
 * This is a deliberately simple extractor — it captures slide text content but
 * not speaker notes, tables, or smart-art. Good enough as AI grounding context.
 */
async function extractPptxText(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return na - nb;
    });

  const slideTexts: string[] = [];
  for (const file of slideFiles) {
    const xml = await zip.file(file)!.async("text");
    const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) ?? [];
    const texts = matches.map((m) =>
      m.replace(/<a:t[^>]*>/, "").replace(/<\/a:t>/, ""),
    );
    if (texts.length) slideTexts.push(texts.join(" "));
  }

  return slideTexts.join("\n\n");
}

/** Map a stored filename to a best-effort MIME type (lesson_materials has no mime column). */
export function mimeFromName(name: string): string {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  switch (ext) {
    case "pdf": return "application/pdf";
    case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "doc": return "application/msword";
    case "pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "csv": return "text/csv";
    case "txt": return "text/plain";
    case "md": return "text/markdown";
    default: return "";
  }
}

/** Filenames we can extract text from. */
export function isExtractable(name: string): boolean {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  return ["pdf", "docx", "doc", "pptx", "csv", "txt", "md"].includes(ext);
}
