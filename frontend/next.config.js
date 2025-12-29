/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  // Only use static export in production
  ...(isDev ? {} : { output: 'export' }),
  distDir: 'out',
  images: {
    unoptimized: true,
  },
  // Add rewrites for development to proxy all API requests to backend
  ...(isDev
    ? {
        async rewrites() {
          return [
            // Proxy API requests to backend, but exclude Next.js internal paths
            {
              source: '/distributions/:path*',
              destination: 'http://localhost:3462/distributions/:path*',
            },
            {
              source: '/location',
              destination: 'http://localhost:3462/location',
            },
          ];
        },
      }
    : {}),
};

module.exports = nextConfig;
