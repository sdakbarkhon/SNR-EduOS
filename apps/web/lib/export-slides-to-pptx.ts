import type { LessonSlide } from "@snr/core";
import type pptxgen from "pptxgenjs";

/** Strip markdown markers to plain text for PPTX body (pptxgenjs has no md support). */
function markdownToPlain(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")        // headings
    .replace(/```[\s\S]*?```/g, "")     // fenced code (rendered separately for layout='code')
    .replace(/\*\*(.+?)\*\*/g, "$1")    // bold
    .replace(/\*(.+?)\*/g, "$1")        // italic
    .replace(/`(.+?)`/g, "$1")          // inline code
    .replace(/^\s*[-*]\s+/gm, "• ")     // bullets
    .trim();
}

async function embedImageBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("[pptx] failed to embed image:", err);
    return null;
  }
}

async function addSlide(pres: pptxgen, slide: LessonSlide): Promise<void> {
  const layout = slide.layout ?? "default";
  const s = pres.addSlide();

  if (layout === "title") {
    s.background = { color: "5B21B6" };
    s.addText(slide.title, {
      x: 0.8, y: 2.4, w: 11.7, h: 1.8,
      fontSize: 40, bold: true, color: "FFFFFF", align: "center",
    });
    if (slide.content) {
      s.addText(markdownToPlain(slide.content), {
        x: 1.8, y: 4.2, w: 9.7, h: 1.5,
        fontSize: 18, color: "E9D5FF", align: "center",
      });
    }
    return;
  }

  if (layout === "quote") {
    s.background = { color: "F1F5F9" };
    const text = slide.quote?.text ?? slide.content;
    s.addText(`"${text}"`, {
      x: 1.2, y: 2.2, w: 10.9, h: 2.8,
      fontSize: 26, italic: true, color: "1E293B", align: "center", valign: "middle",
    });
    if (slide.quote?.author) {
      s.addText(`— ${slide.quote.author}`, {
        x: 1.2, y: 5.1, w: 10.9, h: 0.6,
        fontSize: 16, color: "64748B", align: "center",
      });
    }
    return;
  }

  if (layout === "code" && slide.code) {
    s.background = { color: "0F172A" };
    s.addText(slide.title, {
      x: 0.5, y: 0.3, w: 12.3, h: 0.8, fontSize: 26, bold: true, color: "FFFFFF",
    });
    if (slide.content) {
      s.addText(markdownToPlain(slide.content), {
        x: 0.5, y: 1.2, w: 12.3, h: 1.0, fontSize: 14, color: "CBD5E1",
      });
    }
    s.addText(slide.code.content, {
      x: 0.5, y: 2.3, w: 12.3, h: 4.4,
      fontSize: 13, color: "A5B4FC", fontFace: "Consolas", valign: "top",
      fill: { color: "1E1B33" },
    });
    return;
  }

  if (layout === "split") {
    s.background = { color: "FFFFFF" };
    s.addText(slide.title, {
      x: 0.5, y: 0.3, w: 12.3, h: 0.9, fontSize: 28, bold: true, color: "1E293B",
    });
    s.addText(markdownToPlain(slide.content), {
      x: 0.5, y: 1.4, w: 6.2, h: 5.5, fontSize: 16, color: "475569", valign: "top",
    });
    if (slide.image_url) {
      const base64 = await embedImageBase64(slide.image_url);
      if (base64) s.addImage({ data: base64, x: 7.0, y: 1.4, w: 5.8, h: 3.26 });
    }
    return;
  }

  // default
  s.background = { color: "FFFFFF" };
  s.addText(slide.title, {
    x: 0.5, y: 0.3, w: 12.3, h: 0.9, fontSize: 28, bold: true, color: "1E293B",
  });
  s.addText(markdownToPlain(slide.content), {
    x: 0.5, y: 1.4, w: 12.3, h: 5.5, fontSize: 16, color: "475569", valign: "top",
  });
}

/** Generate and download a .pptx (16:9) from slides. Client-side only. */
export async function exportSlidesToPptx(
  slides: LessonSlide[],
  presentationTitle: string,
): Promise<void> {
  // Lazy-load — keeps pptxgenjs (large, browser-only) out of the initial bundle.
  const { default: pptxgenCtor } = await import("pptxgenjs");
  const pres = new pptxgenCtor();
  pres.layout = "LAYOUT_WIDE"; // 16:9
  pres.title = presentationTitle;

  // Only add a synthetic title slide if none of the AI's own slides use
  // layout='title' — avoids a duplicate title when the deck already opens
  // with one.
  if (!slides.some((s) => s.layout === "title")) {
    const titleSlide = pres.addSlide();
    titleSlide.background = { color: "FFFFFF" };
    titleSlide.addText(presentationTitle, {
      x: 0.5, y: 2.2, w: 12.3, h: 1.5,
      fontSize: 40, bold: true, color: "1E293B", align: "center",
    });
  }

  for (const slide of slides) {
    await addSlide(pres, slide);
  }

  await pres.writeFile({ fileName: `${presentationTitle}.pptx` });
}
