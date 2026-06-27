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
};

export default nextConfig;
