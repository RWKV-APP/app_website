/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  output: 'export',
  distDir: 'out',
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
