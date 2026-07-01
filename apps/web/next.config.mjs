// Self-host the pdfjs-dist worker (public/pdf.worker.min.mjs) instead of
// pointing at a CDN — cdnjs lags behind fresh npm releases and 404s on the
// exact patch version react-pdf enforces. Runs on every `next dev`/`build`/
// `start`, not just install, so it can't go stale or get skipped by a CI
// that doesn't honor postinstall hooks for workspace packages.
import { createRequire } from "module";
const { copyPdfWorker } = createRequire(import.meta.url)("./scripts/copy-pdf-worker.js");
copyPdfWorker();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace-пакеты с исходниками на TS компилируются Next напрямую.
  transpilePackages: ["@snr/core", "@snr/ui-tokens"],
  // Server-only парсеры файлов — не бандлим, грузим из node_modules в Node-рантайме.
  serverExternalPackages: ["pdf-parse", "mammoth", "jszip"],
  eslint: {
    // ESLint подключим отдельно; на этапе скаффолда не блокируем сборку.
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // pptxgenjs (client PPTX export) references node: builtins behind a browser
      // guard. Rewrite the node: scheme to bare names, then stub them out so the
      // client bundle doesn't choke on "Unhandled scheme".
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        os: false,
        path: false,
      };
      // react-pdf/pdfjs-dist probe for node-canvas (server-side rendering
      // fallback) even though we only ever render client-side.
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
    }
    return config;
  },
};

export default nextConfig;
