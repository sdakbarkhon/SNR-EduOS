"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    H5PStandalone?: { H5P: new (el: HTMLElement, options: Record<string, unknown>) => unknown };
  }
}

export function PlayerClient({ contentId }: { contentId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    function boot() {
      if (cancelled || !containerRef.current || !window.H5PStandalone) return;
      try {
        // eslint-disable-next-line no-new
        new window.H5PStandalone.H5P(containerRef.current, {
          h5pJsonPath: `/api/h5p-static/${contentId}`,
          frameJs: "/h5p-standalone/frame.bundle.js",
          frameCss: "/h5p-standalone/styles/h5p.css",
        });
        setLoading(false);
      } catch (e) {
        setError(String(e));
        setLoading(false);
      }
    }

    if (window.H5PStandalone) {
      boot();
    } else {
      const script = document.createElement("script");
      script.src = "/h5p-standalone/main.bundle.js";
      script.onload = boot;
      script.onerror = () => { setError("Не удалось загрузить H5P плеер"); setLoading(false); };
      document.body.appendChild(script);
    }

    return () => { cancelled = true; };
  }, [contentId]);

  return (
    <div style={{ position: "relative", height: "100%", minHeight: 500 }}>
      {loading && !error && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#9a9ab5" }}>
          Загрузка задания...
        </div>
      )}
      {error && (
        <div style={{ padding: 24, color: "#e11d48" }}>Ошибка: {error}</div>
      )}
      <div ref={containerRef} style={{ minHeight: 500 }} />
    </div>
  );
}
