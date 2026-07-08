import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSupabaseEnv } from "@/lib/env";

// Content-type libraries are static assets bundled with the app (see the УЧ.9
// report for exact provenance/versions of each). Everything else under a
// given contentId (h5p.json, content/content.json, content/images/*) lives in
// the Supabase Storage bucket 'h5p-content', uploaded per-content by /editor.
const BUNDLED_LIBRARIES = ["H5P.MemoryGame-1.3", "H5P.Timer-0.4", "FontAwesome-4.5"];

const MIME_TYPES: Record<string, string> = {
  ".json": "application/json",
  ".js": "application/javascript",
  ".css": "text/css",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function mimeFor(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ contentId: string; path: string[] }> },
) {
  const { contentId, path: pathSegments } = await params;
  const relPath = pathSegments.join("/");
  const topSegment = pathSegments[0];

  // 1) Bundled H5P content-type library files -- served from the local static bundle.
  if (topSegment && BUNDLED_LIBRARIES.includes(topSegment)) {
    try {
      const filePath = path.join(process.cwd(), "public", "h5p-libraries", relPath);
      const bytes = await readFile(filePath);
      return new NextResponse(bytes as unknown as BodyInit, {
        headers: { "Content-Type": mimeFor(relPath), "Cache-Control": "public, max-age=31536000, immutable" },
      });
    } catch {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  // 2) Per-content files (h5p.json, content/*) -- proxied from Supabase Storage.
  const { url } = getSupabaseEnv();
  const storageUrl = `${url}/storage/v1/object/public/h5p-content/${contentId}/${relPath}`;
  const upstream = await fetch(storageUrl, { cache: "no-store" });
  if (!upstream.ok) {
    return new NextResponse("Not found", { status: 404 });
  }
  const bytes = await upstream.arrayBuffer();
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? mimeFor(relPath),
      "Cache-Control": "no-store",
    },
  });
}
