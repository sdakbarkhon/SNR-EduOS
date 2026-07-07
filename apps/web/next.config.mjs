/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace-пакеты с исходниками на TS компилируются Next напрямую.
  transpilePackages: ["@snr/core", "@snr/ui-tokens"],
  // Server-only парсеры файлов — не бандлим, грузим из node_modules в Node-рантайме.
  serverExternalPackages: ["pdf-parse", "mammoth", "jszip"],
  async headers() {
    return [
      {
        // TurboWarp's project_url param (docs.turbowarp.org/url-parameters)
        // fetches this cross-origin from turbowarp.org and requires CORS.
        source: "/blank-project.sb3",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
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
