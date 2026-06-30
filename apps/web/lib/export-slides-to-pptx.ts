import pptxgen from "pptxgenjs";
import type { LessonSlide } from "@snr/core";

/** Strip markdown markers to plain text for PPTX body (pptxgenjs has no md support). */
function markdownToPlain(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")        // headings
    .replace(/\*\*(.+?)\*\*/g, "$1")    // bold
    .replace(/\*(.+?)\*/g, "$1")        // italic
    .replace(/`(.+?)`/g, "$1")          // inline code
    .replace(/^\s*[-*]\s+/gm, "• ")     // bullets
    .trim();
}

/** Generate and download a .pptx (16:9) from slides. Client-side only. */
export async function exportSlidesToPptx(
  slides: LessonSlide[],
  presentationTitle: string,
): Promise<void> {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 16:9
  pres.title = presentationTitle;

  // Title slide
  const titleSlide = pres.addSlide();
  titleSlide.background = { color: "FFFFFF" };
  titleSlide.addText(presentationTitle, {
    x: 0.5, y: 2.2, w: 12.3, h: 1.5,
    fontSize: 40, bold: true, color: "1E293B", align: "center",
  });

  for (const slide of slides) {
    const s = pres.addSlide();
    s.background = { color: "FFFFFF" };

    s.addText(slide.title, {
      x: 0.5, y: 0.3, w: 12.3, h: 0.9,
      fontSize: 28, bold: true, color: "1E293B",
    });

    const hasImage = !!slide.image_url;
    s.addText(markdownToPlain(slide.content), {
      x: 0.5, y: 1.4, w: hasImage ? 6.2 : 12.3, h: 5.5,
      fontSize: 16, color: "475569", valign: "top",
    });

    if (slide.image_url) {
      try {
        const response = await fetch(slide.image_url);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        s.addImage({ data: base64, x: 7.0, y: 1.4, w: 5.8, h: 3.26 });
      } catch (err) {
        console.warn("[pptx] failed to embed image:", err);
      }
    }
  }

  await pres.writeFile({ fileName: `${presentationTitle}.pptx` });
}
