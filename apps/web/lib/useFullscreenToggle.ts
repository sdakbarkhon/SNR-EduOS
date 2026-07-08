"use client";

// Shared fullscreen behavior for external-service iframes (УЧ.10 Part 5 — same
// toggle used by the lesson-stage ExternalStageModal and the homework
// external-service view). Wraps the Fullscreen API on a container ref so the
// iframe itself doesn't need `allowfullscreen` plumbing per call site.

import { useEffect, useRef, useState } from "react";

export function useFullscreenToggle<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggle() {
    if (!ref.current) return;
    try {
      if (document.fullscreenElement === ref.current) {
        await document.exitFullscreen();
      } else {
        await ref.current.requestFullscreen();
      }
    } catch {
      // Fullscreen API can reject (e.g. iframe sandboxing, user gesture
      // requirements) — fail silently, the toggle button just stays inert.
    }
  }

  return { ref, isFullscreen, toggle };
}
