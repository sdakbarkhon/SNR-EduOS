/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@snr/core"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
