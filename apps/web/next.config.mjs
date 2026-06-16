/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace-пакеты с исходниками на TS компилируются Next напрямую.
  transpilePackages: ["@snr/core", "@snr/ui-tokens"],
  eslint: {
    // ESLint подключим отдельно; на этапе скаффолда не блокируем сборку.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
